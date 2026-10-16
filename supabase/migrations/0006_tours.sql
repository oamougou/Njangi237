-- =====================================================================
-- Njangi237 v2 : ordre des tours et remise de la cagnotte (tontines uniquement)
-- =====================================================================

create or replace function exiger_tontine(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = p_group and type = 'tontine') then
    raise exception 'Réservé aux tontines' using errcode = 'P0001';
  end if;
end $$;

create or replace function ordonner_tours(p_group uuid, p_order uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype; v_attendus uuid[]; v_recus uuid[];
begin
  perform exiger_tresorier(p_group);
  perform exiger_tontine(p_group);
  select * into v_g from groups where id = p_group for update;
  if v_g.order_locked then
    raise exception 'L''ordre est verrouillé : utilisez l''échange de tours' using errcode = 'P0001';
  end if;
  select array_agg(id order by id) into v_attendus from memberships where group_id = p_group and status <> 'retire';
  select array_agg(x order by x) into v_recus from unnest(p_order) x;
  if v_recus is distinct from v_attendus then
    raise exception 'La liste doit contenir chaque membre une seule fois' using errcode = '22023';
  end if;

  update memberships m set position = o.rang
    from unnest(p_order) with ordinality as o(id, rang)
   where m.id = o.id;
  perform journaliser(p_group, 'ordre_modifie', jsonb_build_object('ordre',
    (select jsonb_agg(display_name order by position) from memberships where group_id = p_group and status <> 'retire')), true);
end $$;

create or replace function tirer_au_sort(p_group uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype; v_ordre jsonb;
begin
  perform exiger_tresorier(p_group);
  perform exiger_tontine(p_group);
  select * into v_g from groups where id = p_group for update;
  if v_g.order_locked then
    raise exception 'L''ordre est verrouillé : utilisez l''échange de tours' using errcode = 'P0001';
  end if;

  update memberships m set position = r.rang
    from (select id, row_number() over (order by gen_random_uuid()) as rang
            from memberships where group_id = p_group and status <> 'retire') r
   where m.id = r.id;
  select jsonb_agg(display_name order by position) into v_ordre
    from memberships where group_id = p_group and status <> 'retire';
  perform journaliser(p_group, 'tirage_au_sort', jsonb_build_object('ordre', v_ordre), true);
  return v_ordre;
end $$;

create or replace function echanger_tours(p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_a memberships%rowtype; v_b memberships%rowtype; v_round int;
begin
  select * into v_a from memberships where id = p_a for update;
  select * into v_b from memberships where id = p_b for update;
  if v_a.id is null or v_b.id is null then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  if v_a.group_id <> v_b.group_id or v_a.id = v_b.id then
    raise exception 'Échange impossible entre ces membres' using errcode = '22023';
  end if;
  perform exiger_tresorier(v_a.group_id);
  perform exiger_tontine(v_a.group_id);
  if v_a.status = 'retire' or v_b.status = 'retire' then raise exception 'Ce membre est retiré' using errcode = 'P0001'; end if;
  select current_round into v_round from groups where id = v_a.group_id;
  if exists (select 1 from payouts where membership_id in (p_a, p_b) and round = v_round and status = 'remis') then
    raise exception 'Un de ces membres a déjà reçu sa part dans ce tour' using errcode = 'P0001';
  end if;

  update memberships set position = case id when p_a then v_b.position else v_a.position end
   where id in (p_a, p_b);
  -- Les contraintes d'unicité de payouts sont « deferrable » : l'échange se vérifie en fin d'instruction
  update payouts set membership_id = case membership_id when p_a then p_b else p_a end
   where membership_id in (p_a, p_b) and round = v_round and status = 'prevu';
  perform journaliser(v_a.group_id, 'tours_echanges',
    jsonb_build_object('a', v_a.display_name, 'b', v_b.display_name), true);
end $$;

create or replace function remplacer_beneficiaire(p_payout uuid, p_membership uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p payouts%rowtype;
begin
  select * into v_p from payouts where id = p_payout;
  if not found then raise exception 'Bénéficiaire introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_p.group_id);
  if v_p.status <> 'prevu' then raise exception 'Cette cagnotte est déjà remise' using errcode = 'P0001'; end if;
  perform echanger_tours(v_p.membership_id, p_membership);
end $$;

create or replace function enregistrer_remise(p_payout uuid, p_amount int, p_method pay_method,
                                              p_reference text default null, p_paid_on date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p payouts%rowtype; v_nom text;
begin
  select * into v_p from payouts where id = p_payout for update;
  if not found then raise exception 'Bénéficiaire introuvable' using errcode = 'P0002'; end if;
  perform exiger_tresorier(v_p.group_id);
  if v_p.status <> 'prevu' then raise exception 'Cette cagnotte est déjà remise' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide' using errcode = '22023'; end if;
  if p_method in ('mtn_momo', 'orange_money') and length(btrim(coalesce(p_reference, ''))) = 0 then
    raise exception 'Référence de transaction obligatoire pour MoMo et Orange Money' using errcode = '22023';
  end if;

  update payouts set amount = p_amount, method = p_method, reference = nullif(btrim(p_reference), ''),
                     paid_on = coalesce(p_paid_on, current_date), status = 'remis', recorded_by = auth.uid()
   where id = p_payout;
  select display_name into v_nom from memberships where id = v_p.membership_id;
  perform journaliser(v_p.group_id, 'cagnotte_remise', jsonb_build_object('nom', v_nom, 'montant', p_amount), true);
  return jsonb_build_object('ecart', p_amount - v_p.amount_expected);
end $$;

create or replace function nouveau_tour(p_group uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_g groups%rowtype;
begin
  perform exiger_tresorier(p_group);
  perform exiger_tontine(p_group);
  select * into v_g from groups where id = p_group for update;
  if exists (select 1 from cycles where group_id = p_group and status = 'ouvert') then
    raise exception 'Clôturez d''abord le cycle en cours' using errcode = 'P0001';
  end if;
  if exists (select 1 from memberships m
              where m.group_id = p_group and m.status <> 'retire'
                and not exists (select 1 from payouts p where p.membership_id = m.id
                                  and p.round = v_g.current_round and p.status = 'remis')) then
    raise exception 'Le tour n''est pas terminé : tous les membres n''ont pas reçu leur part' using errcode = 'P0001';
  end if;

  update groups set current_round = current_round + 1, order_locked = false where id = p_group;
  perform journaliser(p_group, 'nouveau_tour', jsonb_build_object('tour', v_g.current_round + 1), true);
  return v_g.current_round + 1;
end $$;

revoke execute on function exiger_tontine(uuid) from public, anon, authenticated;
revoke execute on function ordonner_tours(uuid, uuid[]), tirer_au_sort(uuid), echanger_tours(uuid, uuid),
                           remplacer_beneficiaire(uuid, uuid), enregistrer_remise(uuid, int, pay_method, text, date),
                           nouveau_tour(uuid) from public, anon;
grant  execute on function ordonner_tours(uuid, uuid[]), tirer_au_sort(uuid), echanger_tours(uuid, uuid),
                           remplacer_beneficiaire(uuid, uuid), enregistrer_remise(uuid, int, pay_method, text, date),
                           nouveau_tour(uuid) to authenticated;
