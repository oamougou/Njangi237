/** Identifiants lisibles : u(1) = 00000000-0000-4000-8000-000000000001 */
export const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const P = { admin: u(1), tres: u(2), alice: u(3), bob: u(4), xavier: u(5) };
export const G = { tontine: u(101), autre: u(102) };
export const M = { tres: u(201), alice: u(202), bob: u(203), invite: u(204), xavier: u(205) };

/**
 * Tontine de 4 membres comptés (Tina trésorière, Alice, Bob, Ines invitée sans compte), 5 000 FCFA, 1 bénéficiaire.
 * Cotisation séparée gérée par Xavier (autre groupe). Admin plateforme = P.admin.
 */
export async function seedPilot(db) {
  await db.exec(`
    insert into auth.users(id, email) values
      ('${P.admin}','237690000001@njangi237.local'), ('${P.tres}','237690000002@njangi237.local'),
      ('${P.alice}','237690000003@njangi237.local'), ('${P.bob}','237690000004@njangi237.local'),
      ('${P.xavier}','237690000005@njangi237.local');
    insert into people(id, phone, full_name) values
      ('${P.admin}','237690000001','Admin'), ('${P.tres}','237690000002','Tina'),
      ('${P.alice}','237690000003','Alice'), ('${P.bob}','237690000004','Bob'),
      ('${P.xavier}','237690000005','Xavier');
    insert into platform_admins(person_id) values ('${P.admin}');
    insert into groups(id, name, type, amount, frequency, beneficiaries_per_cycle, created_by) values
      ('${G.tontine}','Tontine des amis','tontine',5000,'mensuelle',1,'${P.admin}'),
      ('${G.autre}','Cotisation quartier','cotisation',2000,'mensuelle',1,'${P.admin}');
    insert into memberships(id, group_id, person_id, display_name, phone, role, status, position, joined_at) values
      ('${M.tres}',  '${G.tontine}','${P.tres}',  'Tina',  '237690000002','tresorier','actif', 1, now()),
      ('${M.alice}', '${G.tontine}','${P.alice}', 'Alice', '237690000003','membre',   'actif', 2, now()),
      ('${M.bob}',   '${G.tontine}','${P.bob}',   'Bob',   '237690000004','membre',   'actif', 3, now()),
      ('${M.invite}','${G.tontine}',null,         'Ines',  '237690000009','membre',   'invite',4, null),
      ('${M.xavier}','${G.autre}',  '${P.xavier}','Xavier','237690000005','tresorier','actif', 1, now());
  `);
}
