-- =====================================================================
-- Njangi237 v2 : offres et abonnements (lot 7)
-- Offre en vigueur d'un groupe : abonnement payant en cours > Pilote en cours > essai (30 jours) > Découverte.
-- Blocage doux : seuls l'ajout de membres et l'ouverture de cycle dépendent de la limite.
-- =====================================================================

alter table groups drop column plan;
alter table groups add column prix_lancement boolean not null default false;

create table abonnements (
  id         uuid primary key default gen_random_uuid(),
  offre      text not null check (offre in ('groupe', 'association', 'diaspora', 'pilote')),
  debut      timestamptz not null default now(),
  fin        timestamptz not null,
  cree_par   uuid references people(id),
  created_at timestamptz not null default now(),
  check (fin > debut)
);
create table abonnements_groupes (
  abonnement_id uuid not null references abonnements(id) on delete cascade,
  group_id      uuid not null references groups(id) on delete cascade,
  primary key (abonnement_id, group_id)
);
create index abonnements_groupes_groupe_idx on abonnements_groupes(group_id);
create table parametres_plateforme (cle text primary key, valeur text);

alter table abonnements           enable row level security;
alter table abonnements_groupes   enable row level security;
alter table parametres_plateforme enable row level security;
-- Aucune lecture directe : tout passe par les fonctions (comme les invitations)
revoke all on abonnements, abonnements_groupes, parametres_plateforme from anon, authenticated;

create or replace function libelle_offre(p_offre text) returns text
language sql immutable set search_path = public as $$
  select case p_offre when 'decouverte' then 'Découverte' when 'essai' then 'Essai' when 'groupe' then 'Groupe'
    when 'association' then 'Association' when 'diaspora' then 'Diaspora' when 'pilote' then 'Pilote' else p_offre end
$$;

create or replace function offre_en_vigueur(p_group uuid)
returns table (offre text, limite int, fin timestamptz)
language sql stable security definer set search_path = public as $$
  with choix as (
    select a.offre, a.fin
      from abonnements a join abonnements_groupes ag on ag.abonnement_id = a.id
     where ag.group_id = p_group and a.debut <= now() and now() < a.fin
     order by (a.offre = 'pilote'), a.fin desc
     limit 1
  )
  select c.offre, 50, c.fin from choix c
  union all
  select case when now() < g.created_at + interval '30 days' then 'essai' else 'decouverte' end,
         case when now() < g.created_at + interval '30 days' then 50 else 10 end,
         case when now() < g.created_at + interval '30 days' then g.created_at + interval '30 days' end
    from groups g
   where g.id = p_group and not exists (select 1 from choix)
$$;

-- Lot 1 + limite de l'offre en vigueur
create or replace function ajouter_membre(p_group uuid, p_name text, p_phone text, p_role member_role default 'membre')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := normaliser_telephone(p_phone);
  v_g     groups%rowtype;
  v_old   memberships%rowtype;
  v_count int;
  v_pos   int;
  v_id    uuid;
  v_o     record;
begin
  perform exiger_tresorier(p_group);
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Nom obligatoire' using errcode = '22023'; end if;

  select * into v_g from groups where id = p_group for update;
  select count(*) into v_count from memberships where group_id = p_group and status <> 'retire';
  select * into v_o from offre_en_vigueur(p_group);
  if v_o.offre = 'decouverte' and v_count >= v_o.limite then
    raise exception 'Limite de l''offre Découverte atteinte (% membres) : passez à l''offre Groupe dans l''onglet Abonnement', v_o.limite
      using errcode = 'P0001';
  end if;
  if v_count >= least(v_g.max_members, v_o.limite) then
    raise exception 'Nombre maximum de membres atteint (%)', least(v_g.max_members, v_o.limite) using errcode = 'P0001';
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

-- Lot 1 + refus quand le groupe dépasse la limite de son offre
create or replace function ouvrir_cycle(p_group uuid, p_label text, p_due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype; v_id uuid; v_num int; v_n int; v_o record;
begin
  perform exiger_tresorier(p_group);
  if length(btrim(coalesce(p_label, ''))) = 0 then raise exception 'Libellé du cycle obligatoire' using errcode = '22023'; end if;
  select * into v_g from groups where id = p_group for update;
  if exists (select 1 from cycles where group_id = p_group and status = 'ouvert') then
    raise exception 'Un cycle est déjà ouvert : clôturez-le d''abord' using errcode = 'P0001';
  end if;
  select count(*) into v_n from memberships where group_id = p_group and status <> 'retire';
  if v_n = 0 then raise exception 'Aucun membre dans le groupe' using errcode = 'P0001'; end if;
  select * into v_o from offre_en_vigueur(p_group);
  if v_n > v_o.limite then
    raise exception 'Votre groupe compte % membres, l''offre % en permet % : choisissez une offre dans l''onglet Abonnement',
      v_n, libelle_offre(v_o.offre), v_o.limite using errcode = 'P0001';
  end if;

  select coalesce(max(number), 0) + 1 into v_num from cycles where group_id = p_group and round = v_g.current_round;
  insert into cycles(group_id, round, number, label, due_date, amount_expected)
  values (p_group, v_g.current_round, v_num, btrim(p_label), p_due_date, v_g.amount)
  returning id into v_id;

  if v_g.type = 'tontine' then
    update groups set order_locked = true where id = p_group;
    if designer_beneficiaires(v_id) = 0 then
      raise exception 'Tour terminé : tous les membres ont reçu leur part. Démarrez un nouveau tour.' using errcode = 'P0001';
    end if;
  end if;

  perform journaliser(p_group, 'cycle_ouvert', jsonb_build_object('cycle', btrim(p_label)), true);
  return v_id;
end $$;

-- Offre Pilote pour chaque groupe qui n'a encore aucun abonnement (reprise des groupes existants)
create or replace function reprendre_groupes_pilote(p_fin timestamptz) returns int
language plpgsql security definer set search_path = public as $$
declare v_g uuid; v_a uuid; v_n int := 0;
begin
  for v_g in select g.id from groups g
              where not exists (select 1 from abonnements_groupes ag where ag.group_id = g.id) loop
    insert into abonnements(offre, fin) values ('pilote', p_fin) returning id into v_a;
    insert into abonnements_groupes(abonnement_id, group_id) values (v_a, v_g);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Groupes existants : Pilote jusqu'au 31 janvier 2027 inclus, heure de Douala
select reprendre_groupes_pilote('2027-02-01 00:00:00+01');

revoke execute on function libelle_offre(text), offre_en_vigueur(uuid), reprendre_groupes_pilote(timestamptz)
  from public, anon, authenticated;
