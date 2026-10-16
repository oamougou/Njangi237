-- =====================================================================
-- Njangi237 v2 : comptes (invitations, nouveau PIN, blocage après 5 PIN faux, amorçage)
-- Les fonctions « service » ne sont appelables que par la fonction serveur comptes (service_role).
-- =====================================================================

create index invitations_membre_idx on invitations(membership_id, kind) where used_at is null;

-- Le trésorier (ou l'administrateur, pour le premier trésorier) enregistre l'empreinte du lien qu'il envoie
create or replace function inviter(p_membership uuid, p_token_hash text, p_kind invitation_kind default 'invitation')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_m memberships%rowtype; v_groupe text; v_exp timestamptz;
begin
  select * into v_m from memberships where id = p_membership for update;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  -- L'administrateur invite le premier trésorier d'un groupe et peut envoyer un nouveau PIN à quiconque
  if not (is_treasurer(v_m.group_id)
          or (is_platform_admin() and (v_m.role = 'tresorier' or p_kind = 'reinitialisation'))) then
    raise exception 'Réservé aux trésoriers du groupe' using errcode = '42501';
  end if;
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Jeton invalide' using errcode = '22023'; end if;
  if p_kind = 'invitation' and v_m.status <> 'invite' then
    raise exception 'Ce membre a déjà rejoint le groupe' using errcode = 'P0001';
  end if;
  if p_kind = 'reinitialisation' and (v_m.status <> 'actif' or v_m.person_id is null) then
    raise exception 'Ce membre n''a pas encore de compte' using errcode = 'P0001';
  end if;
  -- Le compte est commun à tous les groupes : un trésorier ne peut pas s'emparer de celui d'un trésorier d'ailleurs
  if p_kind = 'reinitialisation' and not is_platform_admin() and exists (
       select 1 from memberships o
        where o.person_id = v_m.person_id and o.status = 'actif' and o.role = 'tresorier'
          and o.group_id <> v_m.group_id and not is_treasurer(o.group_id)) then
    raise exception 'Cette personne est trésorière dans un autre groupe : seul un trésorier de ce groupe peut lui envoyer un lien'
      using errcode = '42501';
  end if;

  -- Un nouveau lien du même type annule le précédent
  update invitations set expires_at = now()
   where membership_id = p_membership and kind = p_kind and used_at is null and expires_at > now();
  v_exp := now() + case p_kind when 'invitation' then interval '7 days' else interval '24 hours' end;
  insert into invitations(membership_id, kind, token_hash, expires_at, created_by)
  values (p_membership, p_kind, p_token_hash, v_exp, auth.uid());

  select name into v_groupe from groups where id = v_m.group_id;
  perform journaliser(v_m.group_id, case p_kind when 'invitation' then 'invitation_envoyee' else 'nouveau_pin_envoye' end,
                      jsonb_build_object('nom', v_m.display_name), false);
  return jsonb_build_object('groupe', v_groupe, 'nom', v_m.display_name, 'phone', v_m.phone, 'expires_at', v_exp);
end $$;

-- Lecture d'un lien encore valable (écran d'accueil du lien, puis contrôle avant toute action)
create or replace function lire_invitation(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_i invitations%rowtype; v_m memberships%rowtype; v_groupe text; v_par text; v_person uuid;
begin
  select * into v_i from invitations where token_hash = p_token_hash;
  if not found or v_i.used_at is not null or v_i.expires_at <= now() then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0002';
  end if;
  select * into v_m from memberships where id = v_i.membership_id;
  select name into v_groupe from groups where id = v_m.group_id;
  select full_name into v_par from people where id = v_i.created_by;
  v_person := coalesce(v_m.person_id, (select id from people where phone = v_m.phone));
  return jsonb_build_object('kind', v_i.kind, 'membership_id', v_m.id, 'groupe', v_groupe, 'invite_par', v_par,
                            'nom', v_m.display_name, 'phone', v_m.phone,
                            'compte_existant', v_person is not null, 'person_id', v_person);
end $$;

-- Après création (ou vérification) du compte Auth : la personne rejoint le groupe
create or replace function finaliser_invitation(p_token_hash text, p_person uuid, p_full_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_i invitations%rowtype; v_m memberships%rowtype; v_p people%rowtype;
begin
  select * into v_i from invitations where token_hash = p_token_hash for update;
  if not found or v_i.used_at is not null or v_i.expires_at <= now() or v_i.kind <> 'invitation' then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0002';
  end if;
  select * into v_m from memberships where id = v_i.membership_id for update;
  if v_m.status <> 'invite' then raise exception 'Lien invalide ou expiré' using errcode = 'P0002'; end if;

  select * into v_p from people where id = p_person;
  if not found then
    insert into people(id, phone, full_name)
    values (p_person, v_m.phone, coalesce(nullif(btrim(p_full_name), ''), v_m.display_name));
  elsif v_p.phone <> v_m.phone then
    raise exception 'Ce lien est destiné à un autre numéro' using errcode = '42501';
  end if;

  update memberships set person_id = p_person, status = 'actif', joined_at = now() where id = v_m.id;
  update invitations set used_at = now() where id = v_i.id;
  insert into journal(group_id, actor, action, details, visible_to_members)
  values (v_m.group_id, p_person, 'membre_rejoint', jsonb_build_object('nom', v_m.display_name), true);
  return jsonb_build_object('group_id', v_m.group_id);
end $$;

-- Nouveau PIN : le lien est consommé AVANT le changement de mot de passe (deux envois simultanés : un seul gagne)
create or replace function finaliser_nouveau_pin(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_i invitations%rowtype; v_m memberships%rowtype;
begin
  select * into v_i from invitations where token_hash = p_token_hash for update;
  if not found or v_i.used_at is not null or v_i.expires_at <= now() or v_i.kind <> 'reinitialisation' then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0002';
  end if;
  select * into v_m from memberships where id = v_i.membership_id;
  if v_m.person_id is null then raise exception 'Lien invalide ou expiré' using errcode = 'P0002'; end if;

  update invitations set used_at = now() where id = v_i.id;
  delete from login_attempts where phone = v_m.phone;
  -- Tracé dans chaque groupe de la personne : le compte leur est commun
  insert into journal(group_id, actor, action, details, visible_to_members)
  select o.group_id, v_i.created_by, 'pin_reinitialise', jsonb_build_object('nom', o.display_name), false
    from memberships o where o.person_id = v_m.person_id and o.status = 'actif';
  return jsonb_build_object('person_id', v_m.person_id, 'phone', v_m.phone);
end $$;

-- Blocage : chaque essai est réservé AVANT de vérifier le PIN (verrou de ligne : des essais simultanés
-- ne passent pas à côté). Le 5e essai pose un blocage de 15 minutes ; une connexion réussie remet à zéro.
create or replace function reserver_essai(p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v login_attempts%rowtype;
begin
  insert into login_attempts(phone, failures) values (p_phone, 0) on conflict (phone) do nothing;
  select * into v from login_attempts where phone = p_phone for update;
  if v.locked_until is not null and v.locked_until > now() then
    return jsonb_build_object('autorise', false, 'bloque_jusqu', v.locked_until);
  end if;
  if v.locked_until is not null then v.failures := 0; v.locked_until := null; end if;
  v.failures := v.failures + 1;
  if v.failures >= 5 then v.failures := 0; v.locked_until := now() + interval '15 minutes'; end if;
  update login_attempts set failures = v.failures, locked_until = v.locked_until where phone = p_phone;
  return jsonb_build_object('autorise', true, 'bloque_jusqu', v.locked_until);
end $$;

-- Essai qui n'a pas pu vérifier le PIN (panne d'Auth) : il ne compte pas
create or replace function annuler_essai(p_phone text) returns void
language sql security definer set search_path = public as $$
  update login_attempts set failures = greatest(failures - 1, 0) where phone = p_phone and locked_until is null
$$;

create or replace function enregistrer_succes(p_phone text) returns void
language sql security definer set search_path = public as $$
  delete from login_attempts where phone = p_phone
$$;

-- Compte Auth resté sans personne (création interrompue) : on le reprend plutôt que de bloquer le numéro
create or replace function compte_auth_orphelin(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select u.id from auth.users u
   where lower(u.email) = lower(p_email) and not exists (select 1 from people p where p.id = u.id)
$$;

-- Amorçage du pilote : le premier administrateur de la plateforme, une seule fois
create or replace function amorcer_admin(p_person uuid, p_phone text, p_full_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  lock table platform_admins in exclusive mode;
  if exists (select 1 from platform_admins) then
    raise exception 'Plateforme déjà initialisée' using errcode = '42501';
  end if;
  insert into people(id, phone, full_name)
  values (p_person, normaliser_telephone(p_phone), coalesce(nullif(btrim(p_full_name), ''), 'Administrateur'))
  on conflict (id) do nothing;
  insert into platform_admins(person_id) values (p_person);
  return jsonb_build_object('person_id', p_person);
end $$;

revoke execute on function inviter(uuid, text, invitation_kind) from public, anon;
grant  execute on function inviter(uuid, text, invitation_kind) to authenticated;
revoke execute on function lire_invitation(text), finaliser_invitation(text, uuid, text), finaliser_nouveau_pin(text),
                           reserver_essai(text), annuler_essai(text), enregistrer_succes(text),
                           compte_auth_orphelin(text), amorcer_admin(uuid, text, text)
  from public, anon, authenticated;
grant  execute on function lire_invitation(text), finaliser_invitation(text, uuid, text), finaliser_nouveau_pin(text),
                           reserver_essai(text), annuler_essai(text), enregistrer_succes(text),
                           compte_auth_orphelin(text), amorcer_admin(uuid, text, text)
  to service_role;
