-- =====================================================================
-- Njangi237 v2 : lecture du journal avec le nom de l'auteur
-- Un membre ne lit pas la fiche `people` des autres : le nom passe par cette fonction,
-- qui applique la même règle que la RLS du journal (trésorier : tout ; membre : entrées visibles).
-- =====================================================================

create or replace function lire_journal(p_group uuid, p_avant bigint default null, p_limite int default 50)
returns table(id bigint, action text, details jsonb, created_at timestamptz, auteur text, visible boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_tres boolean;
begin
  if not is_member(p_group) then
    raise exception 'Réservé aux membres du groupe' using errcode = '42501';
  end if;
  v_tres := is_treasurer(p_group);
  return query
    select j.id, j.action, j.details, j.created_at, p.full_name, j.visible_to_members
      from journal j left join people p on p.id = j.actor
     where j.group_id = p_group
       and (v_tres or j.visible_to_members)
       and (p_avant is null or j.id < p_avant)
     order by j.id desc
     limit least(greatest(coalesce(p_limite, 50), 1), 200);
end $$;

revoke execute on function lire_journal(uuid, bigint, int) from public, anon;
grant  execute on function lire_journal(uuid, bigint, int) to authenticated;
