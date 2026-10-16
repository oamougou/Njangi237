-- =====================================================================
-- Njangi237 v2 : droits d'accès
--   - anon : rien. authenticated : lecture filtrée par RLS, écritures via fonctions serveur.
--   - Les numéros des autres membres ne sortent que pour les trésoriers.
-- =====================================================================

-- Aucune fonction exécutable par défaut : chaque migration accorde explicitement ce qui doit l'être.
-- (Le droit EXECUTE accordé à PUBLIC est global : il se retire sans « in schema ».)
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

create or replace function is_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships
                  where group_id = p_group and person_id = auth.uid() and status = 'actif')
$$;

create or replace function is_treasurer(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships
                  where group_id = p_group and person_id = auth.uid() and status = 'actif' and role = 'tresorier')
$$;

create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where person_id = auth.uid())
$$;

alter table people          enable row level security;
alter table platform_admins enable row level security;
alter table groups          enable row level security;
alter table memberships     enable row level security;
alter table cycles          enable row level security;
alter table debts           enable row level security;
alter table payments        enable row level security;
alter table payouts         enable row level security;
alter table invitations     enable row level security;
alter table login_attempts  enable row level security;
alter table journal         enable row level security;

create policy people_self   on people          for select using (id = auth.uid());
create policy admins_self   on platform_admins for select using (person_id = auth.uid());
create policy groups_read   on groups          for select using (is_member(id));
create policy members_read  on memberships     for select using (person_id = auth.uid() or is_treasurer(group_id));
create policy cycles_read   on cycles          for select using (is_member(group_id));
create policy payments_read on payments        for select using (
  is_treasurer(group_id)
  or exists (select 1 from memberships m where m.id = membership_id and m.person_id = auth.uid()));
create policy debts_read    on debts           for select using (
  is_treasurer(group_id)
  or exists (select 1 from memberships m where m.id = membership_id and m.person_id = auth.uid()));
create policy payouts_read  on payouts         for select using (is_member(group_id));
create policy journal_read  on journal         for select using (
  is_treasurer(group_id) or (visible_to_members and is_member(group_id)));
-- invitations, login_attempts : aucune politique, réservées aux fonctions serveur.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on people, platform_admins, groups, memberships, cycles, debts, payments, payouts, journal to authenticated;

-- Ordre des tours pour tous les membres actifs du groupe, sans les numéros
create or replace function ordre_tours(p_group uuid)
returns table (membership_id uuid, display_name text, role member_role, status member_status,
               "position" int, is_me boolean, servi boolean, prevu boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.display_name, m.role, m.status, m.position,
         coalesce(m.person_id = auth.uid(), false),
         exists (select 1 from payouts p where p.membership_id = m.id and p.round = g.current_round and p.status = 'remis'),
         exists (select 1 from payouts p where p.membership_id = m.id and p.round = g.current_round and p.status = 'prevu')
    from memberships m join groups g on g.id = m.group_id
   where m.group_id = p_group and m.status <> 'retire' and is_member(p_group)
   order by m.position nulls last, m.display_name
$$;

-- Taux de recouvrement par cycle, sans aucun paiement individuel
create or replace function recouvrement(p_group uuid)
returns table (cycle_id uuid, round int, number int, label text, status cycle_status,
               membres int, attendu int, payes int, collecte int)
language sql stable security definer set search_path = public as $$
  select c.id, c.round, c.number, c.label, c.status,
         n.membres, c.amount_expected * n.membres, coalesce(x.payes, 0), coalesce(x.collecte, 0)
    from cycles c
    cross join lateral (
      select count(*)::int as membres from memberships m
       where m.group_id = c.group_id and m.status <> 'retire' and m.created_at <= c.opened_at) n
    left join lateral (
      select count(distinct p.membership_id)::int as payes, sum(p.amount)::int as collecte from payments p
       where p.cycle_id = c.id and p.debt_id is null and p.status = 'valide') x on true
   where c.group_id = p_group and is_member(p_group)
   order by c.round, c.number
$$;

revoke execute on function is_member(uuid), is_treasurer(uuid), is_platform_admin(),
                           ordre_tours(uuid), recouvrement(uuid) from public, anon;
grant  execute on function is_member(uuid), is_treasurer(uuid), is_platform_admin(),
                           ordre_tours(uuid), recouvrement(uuid) to authenticated;

-- Temps réel (lot 4) : tables suivies par l'application
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table payments, cycles, payouts, memberships;
  end if;
end $$;
