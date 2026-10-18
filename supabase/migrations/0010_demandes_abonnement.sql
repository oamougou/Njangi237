-- =====================================================================
-- Njangi237 v2 : demandes d'abonnement, prix et administration (lot 7)
-- Le trésorier paie sur un numéro marchand puis déclare ; l'administrateur accepte ou refuse.
-- =====================================================================

create table demandes_abonnement (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  offre       text not null check (offre in ('groupe', 'association', 'diaspora')),
  duree_mois  int not null check (duree_mois in (1, 12)),
  montant     int not null check (montant > 0),
  devise      text not null check (devise in ('XAF', 'EUR')),
  moyen       pay_method not null,
  reference   text,
  precisions  text,
  statut      text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee', 'annulee')),
  motif       text,
  demande_par uuid references people(id),
  traitee_par uuid references people(id),
  created_at  timestamptz not null default now(),
  traitee_le  timestamptz,
  check (moyen not in ('mtn_momo', 'orange_money') or length(btrim(coalesce(reference, ''))) > 0)
);
create unique index demandes_une_en_attente on demandes_abonnement(group_id) where statut = 'en_attente';
alter table demandes_abonnement enable row level security;
revoke all on demandes_abonnement from anon, authenticated;

-- Prix de lancement : moitié prix arrondi à l'unité supérieure
create or replace function prix_offre(p_offre text, p_duree int, p_lancement boolean)
returns table (montant int, devise text)
language sql immutable set search_path = public as $$
  select ceil(t.base * case when coalesce(p_lancement, false) then 0.5 else 1 end)::int, t.dev
    from (values ('groupe', 1, 2000, 'XAF'), ('groupe', 12, 20000, 'XAF'),
                 ('association', 1, 7500, 'XAF'), ('association', 12, 75000, 'XAF'),
                 ('diaspora', 1, 5, 'EUR'), ('diaspora', 12, 50, 'EUR')) as t(offre, duree, base, dev)
   where t.offre = p_offre and t.duree = p_duree
$$;

create or replace function exiger_admin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'Réservé aux administrateurs de la plateforme' using errcode = '42501';
  end if;
end $$;

-- Allonge l'abonnement en cours de même offre du premier groupe, sinon en crée un ; rattache les groupes donnés
create or replace function prolonger_abonnement(p_groupes uuid[], p_offre text, p_duree int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_a abonnements%rowtype; v_g uuid; v_n int;
begin
  if exists (select 1 from unnest(p_groupes) x where not exists (select 1 from groups g where g.id = x)) then
    raise exception 'Groupe introuvable' using errcode = 'P0002';
  end if;
  select a.* into v_a from abonnements a join abonnements_groupes ag on ag.abonnement_id = a.id
   where ag.group_id = p_groupes[1] and a.offre = p_offre and a.debut <= now() and now() < a.fin
   order by a.fin desc limit 1;
  if found then
    update abonnements set fin = fin + make_interval(months => p_duree) where id = v_a.id returning * into v_a;
  else
    insert into abonnements(offre, debut, fin, cree_par)
    values (p_offre, now(), now() + make_interval(months => p_duree), auth.uid()) returning * into v_a;
  end if;
  foreach v_g in array p_groupes loop
    insert into abonnements_groupes(abonnement_id, group_id) values (v_a.id, v_g) on conflict do nothing;
  end loop;
  select count(*) into v_n from abonnements_groupes where abonnement_id = v_a.id;
  if v_n > (case when p_offre = 'association' then 5 else 1 end) then
    raise exception 'Une offre Association couvre au plus 5 groupes' using errcode = 'P0001';
  end if;
  return v_a.fin;
end $$;

create or replace function demander_abonnement(p_group uuid, p_offre text, p_duree int, p_moyen pay_method,
                                               p_reference text default null, p_precisions text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_p record; v_id uuid;
begin
  perform exiger_tresorier(p_group);
  if p_offre is null or p_offre not in ('groupe', 'association', 'diaspora') then
    raise exception 'Offre inconnue' using errcode = '22023';
  end if;
  if p_duree is null or p_duree not in (1, 12) then raise exception 'Durée invalide : 1 ou 12 mois' using errcode = '22023'; end if;
  if p_moyen in ('mtn_momo', 'orange_money') and length(btrim(coalesce(p_reference, ''))) = 0 then
    raise exception 'Référence de transaction obligatoire pour MoMo et Orange Money' using errcode = '22023';
  end if;
  if exists (select 1 from demandes_abonnement where group_id = p_group and statut = 'en_attente') then
    raise exception 'Une demande est déjà en attente pour ce groupe' using errcode = 'P0001';
  end if;
  select * into v_p from prix_offre(p_offre, p_duree, (select prix_lancement from groups where id = p_group));
  insert into demandes_abonnement(group_id, offre, duree_mois, montant, devise, moyen, reference, precisions, demande_par)
  values (p_group, p_offre, p_duree, v_p.montant, v_p.devise, p_moyen, nullif(btrim(p_reference), ''),
          nullif(btrim(p_precisions), ''), auth.uid())
  returning id into v_id;
  perform journaliser(p_group, 'abonnement_demande',
    jsonb_build_object('offre', p_offre, 'duree', p_duree, 'montant', v_p.montant, 'devise', v_p.devise), false);
  return v_id;
end $$;

create or replace function annuler_demande(p_demande uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_d demandes_abonnement%rowtype;
begin
  select * into v_d from demandes_abonnement where id = p_demande for update;
  if not found then raise exception 'Demande introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_d.group_id);
  if v_d.statut <> 'en_attente' then raise exception 'Cette demande a déjà été traitée' using errcode = 'P0001'; end if;
  update demandes_abonnement set statut = 'annulee', traitee_le = now() where id = p_demande;
  perform journaliser(v_d.group_id, 'abonnement_annule', jsonb_build_object('offre', v_d.offre), false);
end $$;

create or replace function accepter_demande(p_demande uuid, p_autres uuid[] default '{}') returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_d demandes_abonnement%rowtype; v_fin timestamptz;
begin
  perform exiger_admin();
  select * into v_d from demandes_abonnement where id = p_demande for update;
  if not found then raise exception 'Demande introuvable' using errcode = 'P0002'; end if;
  if v_d.statut <> 'en_attente' then raise exception 'Cette demande a déjà été traitée' using errcode = 'P0001'; end if;
  if v_d.offre <> 'association' and coalesce(cardinality(p_autres), 0) > 0 then
    raise exception 'Seule l''offre Association couvre plusieurs groupes' using errcode = '22023';
  end if;
  v_fin := prolonger_abonnement(array[v_d.group_id] || coalesce(p_autres, '{}'), v_d.offre, v_d.duree_mois);
  update demandes_abonnement set statut = 'acceptee', traitee_par = auth.uid(), traitee_le = now() where id = p_demande;
  perform journaliser(v_d.group_id, 'abonnement_accepte', jsonb_build_object('offre', v_d.offre, 'fin', v_fin), false);
  return v_fin;
end $$;

create or replace function refuser_demande(p_demande uuid, p_motif text) returns void
language plpgsql security definer set search_path = public as $$
declare v_d demandes_abonnement%rowtype;
begin
  perform exiger_admin();
  if length(btrim(coalesce(p_motif, ''))) = 0 then raise exception 'Motif obligatoire' using errcode = '22023'; end if;
  select * into v_d from demandes_abonnement where id = p_demande for update;
  if not found then raise exception 'Demande introuvable' using errcode = 'P0002'; end if;
  if v_d.statut <> 'en_attente' then raise exception 'Cette demande a déjà été traitée' using errcode = 'P0001'; end if;
  update demandes_abonnement set statut = 'refusee', motif = btrim(p_motif), traitee_par = auth.uid(), traitee_le = now()
   where id = p_demande;
  perform journaliser(v_d.group_id, 'abonnement_refuse', jsonb_build_object('offre', v_d.offre, 'motif', btrim(p_motif)), false);
end $$;

-- Fin = lendemain 00:00 à Douala (la journée choisie est incluse)
create or replace function attribuer_pilote(p_group uuid, p_fin date) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_fin timestamptz := ((p_fin + 1)::timestamp at time zone 'Africa/Douala'); v_a uuid;
begin
  perform exiger_admin();
  if not exists (select 1 from groups where id = p_group) then raise exception 'Groupe introuvable' using errcode = 'P0002'; end if;
  if p_fin is null or v_fin <= now() then raise exception 'La date de fin doit être dans le futur' using errcode = '22023'; end if;
  select a.id into v_a from abonnements a join abonnements_groupes ag on ag.abonnement_id = a.id
   where ag.group_id = p_group and a.offre = 'pilote' and a.debut <= now() and now() < a.fin limit 1;
  if found then
    update abonnements set fin = v_fin where id = v_a;
  else
    insert into abonnements(offre, fin, cree_par) values ('pilote', v_fin, auth.uid()) returning id into v_a;
    insert into abonnements_groupes(abonnement_id, group_id) values (v_a, p_group);
  end if;
  perform journaliser(p_group, 'pilote_attribue', jsonb_build_object('fin', v_fin), false);
  return v_fin;
end $$;

create or replace function creer_association(p_groupes uuid[], p_duree int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_a uuid; v_g uuid; v_fin timestamptz;
begin
  perform exiger_admin();
  if coalesce(cardinality(p_groupes), 0) not between 1 and 5 then raise exception 'Choisissez de 1 à 5 groupes' using errcode = '22023'; end if;
  if p_duree is null or p_duree not in (1, 12) then raise exception 'Durée invalide : 1 ou 12 mois' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_groupes) x where not exists (select 1 from groups g where g.id = x)) then
    raise exception 'Groupe introuvable' using errcode = 'P0002';
  end if;
  insert into abonnements(offre, debut, fin, cree_par) values ('association', now(), now() + make_interval(months => p_duree), auth.uid())
  returning id, fin into v_a, v_fin;
  foreach v_g in array p_groupes loop
    insert into abonnements_groupes(abonnement_id, group_id) values (v_a, v_g) on conflict do nothing;
    perform journaliser(v_g, 'abonnement_accepte', jsonb_build_object('offre', 'association', 'fin', v_fin), false);
  end loop;
  return v_fin;
end $$;

create or replace function changer_prix_lancement(p_group uuid, p_actif boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  if not exists (select 1 from groups where id = p_group) then raise exception 'Groupe introuvable' using errcode = 'P0002'; end if;
  if p_actif and not (select prix_lancement from groups where id = p_group)
     and (select count(*) from groups where prix_lancement) >= 50 then
    raise exception 'Les 50 prix de lancement sont déjà attribués' using errcode = 'P0001';
  end if;
  update groups set prix_lancement = coalesce(p_actif, false) where id = p_group;
end $$;

create or replace function regler_paiement(p_mtn text, p_orange text, p_beneficiaire text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  insert into parametres_plateforme(cle, valeur) values
    ('mtn', nullif(btrim(p_mtn), '')), ('orange', nullif(btrim(p_orange), '')), ('beneficiaire', nullif(btrim(p_beneficiaire), ''))
  on conflict (cle) do update set valeur = excluded.valeur;
end $$;

create or replace function paiement_plateforme() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mtn', (select valeur from parametres_plateforme where cle = 'mtn'),
    'orange', (select valeur from parametres_plateforme where cle = 'orange'),
    'beneficiaire', (select valeur from parametres_plateforme where cle = 'beneficiaire'))
$$;

create or replace function mon_abonnement(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_o record; v_n int;
begin
  perform exiger_tresorier(p_group);
  select * into v_o from offre_en_vigueur(p_group);
  select count(*) into v_n from memberships where group_id = p_group and status <> 'retire';
  return jsonb_build_object(
    'offre', v_o.offre, 'limite', v_o.limite, 'fin', v_o.fin, 'membres', v_n,
    'prix_lancement', (select prix_lancement from groups where id = p_group),
    'demande', (select jsonb_build_object('id', d.id, 'offre', d.offre, 'duree_mois', d.duree_mois, 'montant', d.montant,
                  'devise', d.devise, 'moyen', d.moyen, 'reference', d.reference, 'precisions', d.precisions, 'statut', d.statut,
                  'motif', d.motif, 'created_at', d.created_at, 'traitee_le', d.traitee_le)
                  from demandes_abonnement d where d.group_id = p_group order by d.created_at desc limit 1),
    'historique', coalesce((select jsonb_agg(jsonb_build_object('offre', a.offre, 'debut', a.debut, 'fin', a.fin) order by a.debut desc)
                  from abonnements a join abonnements_groupes ag on ag.abonnement_id = a.id where ag.group_id = p_group), '[]'::jsonb),
    'paiement', paiement_plateforme());
end $$;

create or replace function admin_abonnements() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exiger_admin();
  return jsonb_build_object(
    'demandes', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'group_id', d.group_id, 'groupe', g.name,
                  'demandeur', p.full_name, 'offre', d.offre, 'duree_mois', d.duree_mois, 'montant', d.montant, 'devise', d.devise,
                  'moyen', d.moyen, 'reference', d.reference, 'precisions', d.precisions, 'statut', d.statut, 'motif', d.motif,
                  'created_at', d.created_at, 'traitee_le', d.traitee_le) order by d.created_at)
                  from demandes_abonnement d join groups g on g.id = d.group_id left join people p on p.id = d.demande_par
                 where d.statut = 'en_attente'), '[]'::jsonb),
    'groupes', coalesce((select jsonb_agg(jsonb_build_object('group_id', g.id, 'nom', g.name, 'offre', o.offre, 'fin', o.fin,
                  'limite', o.limite, 'prix_lancement', g.prix_lancement,
                  'membres', (select count(*) from memberships m where m.group_id = g.id and m.status <> 'retire')) order by g.name)
                  from groups g cross join lateral offre_en_vigueur(g.id) o), '[]'::jsonb),
    'lancements', (select count(*) from groups where prix_lancement),
    'paiement', paiement_plateforme());
end $$;

revoke execute on function prix_offre(text, int, boolean), exiger_admin(), prolonger_abonnement(uuid[], text, int),
                           paiement_plateforme()
  from public, anon, authenticated;
revoke execute on function demander_abonnement(uuid, text, int, pay_method, text, text), annuler_demande(uuid),
                           accepter_demande(uuid, uuid[]), refuser_demande(uuid, text), attribuer_pilote(uuid, date),
                           creer_association(uuid[], int), changer_prix_lancement(uuid, boolean), regler_paiement(text, text, text),
                           mon_abonnement(uuid), admin_abonnements()
  from public, anon;
grant execute on function demander_abonnement(uuid, text, int, pay_method, text, text), annuler_demande(uuid),
                          accepter_demande(uuid, uuid[]), refuser_demande(uuid, text), attribuer_pilote(uuid, date),
                          creer_association(uuid[], int), changer_prix_lancement(uuid, boolean), regler_paiement(text, text, text),
                          mon_abonnement(uuid), admin_abonnements()
  to authenticated;
