-- =====================================================================
-- Njangi237 v2 : cycles (ouverture, clôture avec dettes, réouverture tracée)
-- Membre « compté » = adhésion invite ou actif (voir plan, écart n°3).
-- =====================================================================

-- Les k membres suivants dans l'ordre, sans remise dans le tour du cycle, deviennent bénéficiaires prévus
create or replace function designer_beneficiaires(p_cycle uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_c cycles%rowtype; v_g groups%rowtype; v_n int; v_each int; v_count int;
begin
  select * into v_c from cycles where id = p_cycle;
  select * into v_g from groups where id = v_c.group_id;
  if v_g.type <> 'tontine' then return 0; end if;

  select count(*) into v_n from memberships where group_id = v_g.id and status <> 'retire';
  v_each := (v_c.amount_expected * v_n) / v_g.beneficiaries_per_cycle;

  insert into payouts(group_id, cycle_id, round, membership_id, amount_expected)
  select v_g.id, v_c.id, v_c.round, m.id, v_each
    from memberships m
   where m.group_id = v_g.id and m.status <> 'retire'
     and not exists (select 1 from payouts p where p.membership_id = m.id and p.round = v_c.round)
   order by m.position nulls last, m.created_at
   limit v_g.beneficiaries_per_cycle;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function ouvrir_cycle(p_group uuid, p_label text, p_due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype; v_id uuid; v_num int; v_n int;
begin
  perform exiger_tresorier(p_group);
  if length(btrim(coalesce(p_label, ''))) = 0 then raise exception 'Libellé du cycle obligatoire' using errcode = '22023'; end if;
  select * into v_g from groups where id = p_group for update;
  if exists (select 1 from cycles where group_id = p_group and status = 'ouvert') then
    raise exception 'Un cycle est déjà ouvert : clôturez-le d''abord' using errcode = 'P0001';
  end if;
  select count(*) into v_n from memberships where group_id = p_group and status <> 'retire';
  if v_n = 0 then raise exception 'Aucun membre dans le groupe' using errcode = 'P0001'; end if;

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

create or replace function clore_cycle(p_cycle uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_c cycles%rowtype; v_pending int; v_n int; v_sum int;
begin
  select * into v_c from cycles where id = p_cycle for update;
  if not found then raise exception 'Cycle introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_c.group_id);
  if v_c.status <> 'ouvert' then raise exception 'Ce cycle est déjà clos' using errcode = 'P0001'; end if;

  select count(*) into v_pending from payments where cycle_id = p_cycle and debt_id is null and status = 'declare';
  if v_pending > 0 then
    raise exception '% paiement(s) à valider ou contester avant de clore', v_pending using errcode = 'P0001';
  end if;

  insert into debts(group_id, membership_id, cycle_id, amount)
  select v_c.group_id, m.id, v_c.id, v_c.amount_expected - coalesce(p.amount, 0)
    from memberships m
    left join payments p on p.cycle_id = v_c.id and p.membership_id = m.id
                        and p.debt_id is null and p.status = 'valide'
   where m.group_id = v_c.group_id and m.status <> 'retire' and m.created_at <= v_c.opened_at
     and coalesce(p.amount, 0) < v_c.amount_expected;
  get diagnostics v_n = row_count;
  select coalesce(sum(amount), 0)::int into v_sum from debts where cycle_id = p_cycle;

  update cycles set status = 'clos', closed_at = now() where id = p_cycle;
  perform journaliser(v_c.group_id, 'cycle_clos', jsonb_build_object('cycle', v_c.label, 'dettes', v_n), true);
  return jsonb_build_object('dettes', v_n, 'montant', v_sum);
end $$;

create or replace function rouvrir_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_c cycles%rowtype;
begin
  select * into v_c from cycles where id = p_cycle for update;
  if not found then raise exception 'Cycle introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_c.group_id);
  if v_c.status <> 'clos' then raise exception 'Ce cycle n''est pas clos' using errcode = 'P0001'; end if;
  if exists (select 1 from cycles where group_id = v_c.group_id and status = 'ouvert') then
    raise exception 'Un autre cycle est ouvert' using errcode = 'P0001';
  end if;
  if exists (select 1 from cycles where group_id = v_c.group_id
               and (round > v_c.round or (round = v_c.round and number > v_c.number))) then
    raise exception 'Seul le dernier cycle peut être rouvert' using errcode = 'P0001';
  end if;
  if exists (select 1 from debts d where d.cycle_id = p_cycle and (d.settled_at is not null or exists (
               select 1 from payments p where p.debt_id = d.id and p.status <> 'conteste'))) then
    raise exception 'Des dettes de ce cycle ont déjà des règlements' using errcode = 'P0001';
  end if;

  delete from debts where cycle_id = p_cycle;
  update cycles set status = 'ouvert', closed_at = null where id = p_cycle;
  perform journaliser(v_c.group_id, 'cycle_rouvert', jsonb_build_object('cycle', v_c.label), false);
end $$;

revoke execute on function designer_beneficiaires(uuid) from public, anon, authenticated;
revoke execute on function ouvrir_cycle(uuid, text, date), clore_cycle(uuid), rouvrir_cycle(uuid) from public, anon;
grant  execute on function ouvrir_cycle(uuid, text, date), clore_cycle(uuid), rouvrir_cycle(uuid) to authenticated;
