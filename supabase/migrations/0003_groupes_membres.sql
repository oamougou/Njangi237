-- =====================================================================
-- Njangi237 v2 : groupes et membres
-- =====================================================================

-- Numéro camerounais : chiffres seuls, préfixe 00 retiré, 237 ajouté devant 9 chiffres
create or replace function normaliser_telephone(p text) returns text
language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '00%' then d := substr(d, 3); end if;
  if length(d) = 9 then d := '237' || d; end if;
  if d !~ '^237[0-9]{9}$' then
    raise exception 'Numéro de téléphone invalide' using errcode = '22023';
  end if;
  return d;
end $$;

create or replace function journaliser(p_group uuid, p_action text, p_details jsonb default '{}', p_visible boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into journal(group_id, actor, action, details, visible_to_members)
  values (p_group, auth.uid(), p_action, coalesce(p_details, '{}'), p_visible)
$$;

create or replace function exiger_tresorier(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_treasurer(p_group) then
    raise exception 'Réservé aux trésoriers du groupe' using errcode = '42501';
  end if;
end $$;

create or replace function garder_un_tresorier(p_group uuid, p_sauf uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from memberships
                  where group_id = p_group and role = 'tresorier' and status = 'actif' and id <> p_sauf) then
    raise exception 'Le groupe doit garder au moins un trésorier actif' using errcode = 'P0001';
  end if;
end $$;

create or replace function creer_groupe(p_name text, p_type group_type, p_amount int, p_frequency group_frequency,
                                        p_beneficiaries int, p_treasurer_name text, p_treasurer_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_group uuid; v_m uuid;
begin
  if not is_platform_admin() then
    raise exception 'Réservé aux administrateurs de la plateforme' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Nom du groupe obligatoire' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_treasurer_name, ''))) = 0 then raise exception 'Nom du trésorier obligatoire' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide' using errcode = '22023'; end if;
  if p_beneficiaries is null or p_beneficiaries < 1 then
    raise exception 'Nombre de bénéficiaires par cycle invalide' using errcode = '22023';
  end if;

  insert into groups(name, type, amount, frequency, beneficiaries_per_cycle, created_by)
  values (btrim(p_name), p_type, p_amount, p_frequency, p_beneficiaries, auth.uid())
  returning id into v_group;

  insert into memberships(group_id, display_name, phone, role, status, position)
  values (v_group, btrim(p_treasurer_name), normaliser_telephone(p_treasurer_phone), 'tresorier', 'invite', 1)
  returning id into v_m;

  perform journaliser(v_group, 'groupe_cree', jsonb_build_object('nom', btrim(p_name)), true);
  return jsonb_build_object('group_id', v_group, 'membership_id', v_m);
end $$;

create or replace function ajouter_membre(p_group uuid, p_name text, p_phone text, p_role member_role default 'membre')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := normaliser_telephone(p_phone);
  v_g     groups%rowtype;
  v_old   memberships%rowtype;
  v_count int;
  v_pos   int;
  v_id    uuid;
begin
  perform exiger_tresorier(p_group);
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Nom obligatoire' using errcode = '22023'; end if;

  select * into v_g from groups where id = p_group for update;
  select count(*) into v_count from memberships where group_id = p_group and status <> 'retire';
  if v_count >= v_g.max_members then
    raise exception 'Nombre maximum de membres atteint (%)', v_g.max_members using errcode = 'P0001';
  end if;
  select coalesce(max(position), 0) + 1 into v_pos from memberships where group_id = p_group and status <> 'retire';

  select * into v_old from memberships where group_id = p_group and phone = v_phone;
  if found then
    if v_old.status <> 'retire' then
      raise exception 'Ce numéro est déjà dans le groupe' using errcode = '23505';
    end if;
    update memberships
       set display_name = btrim(p_name), role = p_role, status = 'invite', position = v_pos,
           left_at = null, joined_at = null
     where id = v_old.id;
    v_id := v_old.id;
  else
    insert into memberships(group_id, display_name, phone, role, status, position)
    values (p_group, btrim(p_name), v_phone, p_role, 'invite', v_pos)
    returning id into v_id;
  end if;

  perform journaliser(p_group, 'membre_ajoute', jsonb_build_object('nom', btrim(p_name)), false);
  return v_id;
end $$;

create or replace function changer_role(p_membership uuid, p_role member_role) returns void
language plpgsql security definer set search_path = public as $$
declare v_m memberships%rowtype;
begin
  select * into v_m from memberships where id = p_membership for update;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_m.group_id);
  if v_m.status = 'retire' then raise exception 'Ce membre est retiré' using errcode = 'P0001'; end if;
  if v_m.role = 'tresorier' and p_role = 'membre' then
    perform garder_un_tresorier(v_m.group_id, v_m.id);
  end if;
  update memberships set role = p_role where id = p_membership;
  perform journaliser(v_m.group_id, 'role_change',
    jsonb_build_object('nom', v_m.display_name, 'role', p_role), false);
end $$;

-- Ce que le membre doit encore s'il quitte le groupe maintenant
create or replace function apercu_retrait(p_membership uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_m        memberships%rowtype;
  v_g        groups%rowtype;
  v_open     uuid;
  v_servi    boolean;
  v_attente  int;
  v_restants int := 0;
begin
  select * into v_m from memberships where id = p_membership;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_m.group_id);
  select * into v_g from groups where id = v_m.group_id;
  select id into v_open from cycles where group_id = v_g.id and status = 'ouvert';

  v_servi := exists (select 1 from payouts
                      where membership_id = v_m.id and round = v_g.current_round and status = 'remis');
  if v_g.type = 'tontine' and v_servi then
    -- Cycles encore à venir dans ce tour : membres sans aucune remise (prévue ou faite), k par cycle
    select count(*) into v_attente from memberships m
     where m.group_id = v_g.id and m.status <> 'retire' and m.id <> v_m.id
       and not exists (select 1 from payouts p where p.membership_id = m.id and p.round = v_g.current_round);
    v_restants := ceil(v_attente::numeric / v_g.beneficiaries_per_cycle)::int;
  end if;
  if v_open is not null and not exists (
       select 1 from payments where cycle_id = v_open and membership_id = v_m.id
                                and debt_id is null and status = 'valide') then
    v_restants := v_restants + 1;
  end if;

  return jsonb_build_object('deja_servi', v_servi, 'cycles_restants', v_restants,
                            'montant_restant', v_restants * v_g.amount);
end $$;

create or replace function retirer_membre(p_membership uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m memberships%rowtype; v_apercu jsonb;
begin
  select * into v_m from memberships where id = p_membership for update;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_m.group_id);
  if v_m.status = 'retire' then raise exception 'Ce membre est déjà retiré' using errcode = 'P0001'; end if;
  if v_m.role = 'tresorier' then perform garder_un_tresorier(v_m.group_id, v_m.id); end if;
  if exists (select 1 from payouts p join cycles c on c.id = p.cycle_id
              where p.membership_id = v_m.id and p.status = 'prevu' and c.status = 'ouvert') then
    raise exception 'Ce membre est bénéficiaire du cycle en cours : remplacez-le d''abord' using errcode = 'P0001';
  end if;

  v_apercu := apercu_retrait(p_membership);
  update memberships set status = 'retire', left_at = now(), position = null where id = p_membership;
  perform journaliser(v_m.group_id, 'membre_retire', jsonb_build_object('nom', v_m.display_name), true);
  return v_apercu;
end $$;

revoke execute on function normaliser_telephone(text), journaliser(uuid, text, jsonb, boolean),
                           exiger_tresorier(uuid), garder_un_tresorier(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function creer_groupe(text, group_type, int, group_frequency, int, text, text),
                           ajouter_membre(uuid, text, text, member_role), changer_role(uuid, member_role),
                           apercu_retrait(uuid), retirer_membre(uuid)
  from public, anon;
grant execute on function creer_groupe(text, group_type, int, group_frequency, int, text, text),
                          ajouter_membre(uuid, text, text, member_role), changer_role(uuid, member_role),
                          apercu_retrait(uuid), retirer_membre(uuid)
  to authenticated;
