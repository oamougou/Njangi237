-- Vérification rapide sur Supabase : tout est annulé à la fin (rollback).
begin;
insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-000000000002','237690000002@njangi237.local'),
  ('00000000-0000-4000-8000-000000000003','237690000003@njangi237.local');
insert into people(id, phone, full_name) values
  ('00000000-0000-4000-8000-000000000002','237690000002','Tina'),
  ('00000000-0000-4000-8000-000000000003','237690000003','Alice');
insert into groups(id, name, amount) values ('00000000-0000-4000-8000-000000000101','Smoke',5000);
insert into memberships(id, group_id, person_id, display_name, phone, role, status, position) values
  ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000002','Tina','237690000002','tresorier','actif',1),
  ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000003','Alice','237690000003','membre','actif',2);
create temp table r(etape text, res jsonb) on commit drop;
grant insert, select on r to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into r select 'ouvrir', to_jsonb(ouvrir_cycle('00000000-0000-4000-8000-000000000101', 'Smoke 1'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
insert into r select 'declarer', declarer_paiement('00000000-0000-4000-8000-000000000301',
  (select (res #>> '{}')::uuid from r where etape = 'ouvrir'), 5000, 'mtn_momo', 'MP1');
insert into r select 'alice_voit_paiements', to_jsonb((select count(*) from payments));
insert into r select 'alice_voit_adhesions', to_jsonb((select count(*) from memberships));
insert into r select 'ordre', (select jsonb_agg(display_name) from ordre_tours('00000000-0000-4000-8000-000000000101'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select valider_paiement('00000000-0000-4000-8000-000000000301');
insert into r select 'recouvrement', (select to_jsonb(x) from recouvrement('00000000-0000-4000-8000-000000000101') x);
reset role;
select * from r;
rollback;
