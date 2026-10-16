-- =====================================================================
-- Njangi237 v2 : paiements (déclaration idempotente, validation, contestation, dettes)
-- =====================================================================

create or replace function declarer_paiement(p_id uuid, p_cycle uuid, p_amount int, p_method pay_method,
                                             p_reference text default null, p_paid_on date default null,
                                             p_debt uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old payments%rowtype; v_c cycles%rowtype; v_m uuid; v_d debts%rowtype;
begin
  -- Idempotence : la file hors ligne peut renvoyer la même déclaration
  select * into v_old from payments where id = p_id;
  if found then
    if v_old.declared_by = auth.uid() then
      return jsonb_build_object('ok', true, 'duplicate', true, 'status', v_old.status);
    end if;
    raise exception 'Identifiant de paiement déjà utilisé' using errcode = '23505';
  end if;

  select * into v_c from cycles where id = p_cycle;
  if not found then raise exception 'Cycle introuvable' using errcode = 'P0002'; end if;
  select id into v_m from memberships where group_id = v_c.group_id and person_id = auth.uid() and status = 'actif';
  if v_m is null then raise exception 'Vous n''êtes pas membre de ce groupe' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide' using errcode = '22023'; end if;
  if p_method in ('mtn_momo', 'orange_money') and length(btrim(coalesce(p_reference, ''))) = 0 then
    raise exception 'Référence de transaction obligatoire pour MoMo et Orange Money' using errcode = '22023';
  end if;

  if p_debt is null then
    if v_c.status <> 'ouvert' then raise exception 'Ce cycle est clos' using errcode = 'P0001'; end if;
  else
    select * into v_d from debts where id = p_debt;
    if not found or v_d.membership_id <> v_m or v_d.cycle_id <> p_cycle then
      raise exception 'Dette introuvable' using errcode = 'P0002';
    end if;
    if v_d.settled_at is not null then raise exception 'Cette dette est déjà réglée' using errcode = 'P0001'; end if;
  end if;

  begin
    insert into payments(id, group_id, cycle_id, membership_id, debt_id, amount, method, reference, paid_on, status, declared_by)
    values (p_id, v_c.group_id, p_cycle, v_m, p_debt, p_amount, p_method, nullif(btrim(p_reference), ''),
            coalesce(p_paid_on, current_date), 'declare', auth.uid());
  exception when unique_violation then
    raise exception 'Un paiement est déjà enregistré pour ce cycle' using errcode = '23505';
  end;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'declare');
end $$;

create or replace function saisir_especes(p_id uuid, p_membership uuid, p_cycle uuid, p_amount int,
                                          p_paid_on date default null, p_debt uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old payments%rowtype; v_m memberships%rowtype; v_c cycles%rowtype; v_d debts%rowtype;
begin
  select * into v_old from payments where id = p_id;
  if found then
    if v_old.declared_by = auth.uid() then
      return jsonb_build_object('ok', true, 'duplicate', true, 'status', v_old.status);
    end if;
    raise exception 'Identifiant de paiement déjà utilisé' using errcode = '23505';
  end if;

  select * into v_m from memberships where id = p_membership;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_m.group_id);
  select * into v_c from cycles where id = p_cycle;
  if not found or v_c.group_id <> v_m.group_id then raise exception 'Cycle introuvable' using errcode = 'P0002'; end if;
  if v_m.status = 'retire' then raise exception 'Ce membre est retiré' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide' using errcode = '22023'; end if;

  if p_debt is null then
    if v_c.status <> 'ouvert' then raise exception 'Ce cycle est clos' using errcode = 'P0001'; end if;
  else
    select * into v_d from debts where id = p_debt;
    if not found or v_d.membership_id <> p_membership or v_d.cycle_id <> p_cycle then
      raise exception 'Dette introuvable' using errcode = 'P0002';
    end if;
    if v_d.settled_at is not null then raise exception 'Cette dette est déjà réglée' using errcode = 'P0001'; end if;
  end if;

  begin
    insert into payments(id, group_id, cycle_id, membership_id, debt_id, amount, method, paid_on,
                         status, declared_by, validated_by, validated_at)
    values (p_id, v_m.group_id, p_cycle, p_membership, p_debt, p_amount, 'especes', coalesce(p_paid_on, current_date),
            'valide', auth.uid(), auth.uid(), now());
  exception when unique_violation then
    raise exception 'Un paiement est déjà enregistré pour ce cycle' using errcode = '23505';
  end;
  if p_debt is not null then update debts set settled_at = now() where id = p_debt; end if;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'valide');
end $$;

create or replace function valider_paiement(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p payments%rowtype;
begin
  select * into v_p from payments where id = p_payment for update;
  if not found then raise exception 'Paiement introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_p.group_id);
  if v_p.status <> 'declare' then
    raise exception 'Ce paiement n''est pas en attente de validation' using errcode = 'P0001';
  end if;
  update payments set status = 'valide', validated_by = auth.uid(), validated_at = now() where id = p_payment;
  if v_p.debt_id is not null then update debts set settled_at = now() where id = v_p.debt_id; end if;
end $$;

create or replace function contester_paiement(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_p payments%rowtype; v_cycle_status cycle_status; v_nom text;
begin
  select * into v_p from payments where id = p_payment for update;
  if not found then raise exception 'Paiement introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_p.group_id);
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'Motif obligatoire' using errcode = '22023'; end if;
  if v_p.status = 'conteste' then raise exception 'Ce paiement est déjà contesté' using errcode = 'P0001'; end if;
  select status into v_cycle_status from cycles where id = v_p.cycle_id;
  if v_p.debt_id is null and v_cycle_status = 'clos' then
    raise exception 'Ce cycle est clos' using errcode = 'P0001';
  end if;

  update payments set status = 'conteste', contest_reason = btrim(p_reason),
                      validated_by = auth.uid(), validated_at = now()
   where id = p_payment;
  if v_p.debt_id is not null then update debts set settled_at = null where id = v_p.debt_id; end if;

  select display_name into v_nom from memberships where id = v_p.membership_id;
  perform journaliser(v_p.group_id, 'paiement_conteste',
    jsonb_build_object('nom', v_nom, 'montant', v_p.amount, 'motif', btrim(p_reason)), false);
end $$;

revoke execute on function declarer_paiement(uuid, uuid, int, pay_method, text, date, uuid),
                           saisir_especes(uuid, uuid, uuid, int, date, uuid),
                           valider_paiement(uuid), contester_paiement(uuid, text) from public, anon;
grant  execute on function declarer_paiement(uuid, uuid, int, pay_method, text, date, uuid),
                           saisir_especes(uuid, uuid, uuid, int, date, uuid),
                           valider_paiement(uuid), contester_paiement(uuid, text) to authenticated;
