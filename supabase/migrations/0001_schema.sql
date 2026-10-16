-- =====================================================================
-- Njangi237 v2 : schéma (montants en FCFA entiers, numéros au format 237XXXXXXXXX)
-- =====================================================================

create type group_type      as enum ('tontine','cotisation','association','autre');
create type group_frequency as enum ('hebdomadaire','mensuelle','ponctuelle');
create type member_role     as enum ('tresorier','membre');
create type member_status   as enum ('invite','actif','retire');
create type cycle_status    as enum ('ouvert','clos');
create type pay_method      as enum ('mtn_momo','orange_money','especes','autre');
create type pay_status      as enum ('declare','valide','conteste');
create type payout_status   as enum ('prevu','remis');
create type invitation_kind as enum ('invitation','reinitialisation');

create table people (
  id         uuid primary key references auth.users(id) on delete cascade,
  phone      text not null unique check (phone ~ '^237[0-9]{9}$'),
  full_name  text not null check (length(btrim(full_name)) > 0),
  created_at timestamptz not null default now()
);

create table platform_admins (
  person_id uuid primary key references people(id) on delete cascade
);

create table groups (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (length(btrim(name)) > 0),
  type                    group_type not null default 'tontine',
  amount                  int not null check (amount > 0),
  frequency               group_frequency not null default 'mensuelle',
  beneficiaries_per_cycle int not null default 1 check (beneficiaries_per_cycle >= 1),
  plan                    text not null default 'pilote',
  max_members             int not null default 50 check (max_members > 0),
  order_locked            boolean not null default false,
  current_round           int not null default 1 check (current_round >= 1),
  created_by              uuid references people(id),
  created_at              timestamptz not null default now()
);

create table memberships (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  person_id    uuid references people(id),
  display_name text not null check (length(btrim(display_name)) > 0),
  phone        text not null check (phone ~ '^237[0-9]{9}$'),
  role         member_role not null default 'membre',
  status       member_status not null default 'invite',
  position     int,
  joined_at    timestamptz,
  left_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (group_id, phone),
  unique (group_id, person_id)
);
create index memberships_person_idx on memberships(person_id) where status = 'actif';

create table cycles (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  round           int not null,
  number          int not null,
  label           text not null check (length(btrim(label)) > 0),
  due_date        date,
  amount_expected int not null check (amount_expected > 0),
  status          cycle_status not null default 'ouvert',
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  unique (group_id, round, number)
);
create unique index cycles_un_ouvert on cycles(group_id) where status = 'ouvert';

create table debts (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  membership_id uuid not null references memberships(id) on delete cascade,
  cycle_id      uuid not null references cycles(id) on delete cascade,
  amount        int not null check (amount > 0),
  settled_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (membership_id, cycle_id)
);

create table payments (
  id             uuid primary key,                       -- généré sur le téléphone (idempotence)
  group_id       uuid not null references groups(id) on delete cascade,
  cycle_id       uuid not null references cycles(id) on delete cascade,
  membership_id  uuid not null references memberships(id) on delete cascade,
  debt_id        uuid references debts(id) on delete set null,
  amount         int not null check (amount > 0),
  method         pay_method not null,
  reference      text,
  paid_on        date not null default current_date,
  status         pay_status not null default 'declare',
  declared_by    uuid not null references people(id),
  validated_by   uuid references people(id),
  validated_at   timestamptz,
  contest_reason text,
  created_at     timestamptz not null default now(),
  check (method not in ('mtn_momo','orange_money') or length(btrim(coalesce(reference, ''))) > 0)
);
create unique index payments_un_par_cycle on payments(cycle_id, membership_id)
  where debt_id is null and status <> 'conteste';
create unique index payments_un_par_dette on payments(debt_id)
  where debt_id is not null and status <> 'conteste';
create index payments_group_idx on payments(group_id, cycle_id);

create table payouts (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  cycle_id        uuid not null references cycles(id) on delete cascade,
  round           int not null,
  membership_id   uuid not null references memberships(id) on delete cascade,
  amount_expected int not null,
  amount          int check (amount > 0),
  method          pay_method,
  reference       text,
  paid_on         date,
  status          payout_status not null default 'prevu',
  recorded_by     uuid references people(id),
  created_at      timestamptz not null default now(),
  constraint payouts_cycle_membre unique (cycle_id, membership_id) deferrable initially immediate,
  constraint payouts_tour_membre unique (group_id, round, membership_id) deferrable initially immediate,
  check (status = 'prevu' or (amount is not null and method is not null and paid_on is not null))
);

create table invitations (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  kind          invitation_kind not null,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_by    uuid references people(id),
  created_at    timestamptz not null default now()
);

create table login_attempts (
  phone        text primary key,
  failures     int not null default 0,
  locked_until timestamptz
);

create table journal (
  id                 bigint generated always as identity primary key,
  group_id           uuid not null references groups(id) on delete cascade,
  actor              uuid references people(id),
  action             text not null,
  details            jsonb not null default '{}',
  visible_to_members boolean not null default false,
  created_at         timestamptz not null default now()
);
create index journal_group_idx on journal(group_id, created_at desc);
