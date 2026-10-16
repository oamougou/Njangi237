import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, as } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });

const C1 = u(401);
async function seed() {
  await seedPilot(db);
  await db.exec(`
    insert into cycles(id, group_id, round, number, label, amount_expected) values ('${C1}','${G.tontine}',1,1,'Octobre',5000);
    insert into payments(id, group_id, cycle_id, membership_id, amount, method, reference, status, declared_by) values
      ('${u(301)}','${G.tontine}','${C1}','${M.alice}',5000,'mtn_momo','MP1','valide','${P.alice}'),
      ('${u(302)}','${G.tontine}','${C1}','${M.bob}',5000,'orange_money','OM1','declare','${P.bob}');
    insert into payouts(group_id, cycle_id, round, membership_id, amount_expected) values ('${G.tontine}','${C1}',1,'${M.tres}',20000);
    insert into journal(group_id, action, visible_to_members) values
      ('${G.tontine}','tirage_au_sort',true), ('${G.tontine}','paiement_conteste',false);`);
}
const ids = (rows) => rows.map((r) => r.id).sort();

test("un visiteur non connecté ne lit rien", () => scenario(db, async () => {
  await seed();
  await assert.rejects(as(db, null, "select * from groups"), /permission denied/);
  await assert.rejects(as(db, null, "select * from payments"), /permission denied/);
}));

test("un membre voit son groupe, son adhésion et ses seuls paiements", () => scenario(db, async () => {
  await seed();
  assert.deepEqual((await as(db, P.alice, "select name from groups")).map((r) => r.name), ["Tontine des amis"]);
  assert.deepEqual(ids(await as(db, P.alice, "select id from memberships")), [M.alice]);
  assert.deepEqual(ids(await as(db, P.alice, "select id from payments")), [u(301)]);
  assert.equal((await as(db, P.alice, "select * from cycles")).length, 1);
  assert.equal((await as(db, P.alice, "select * from payouts")).length, 1);
}));

test("le trésorier voit tous les paiements et toutes les adhésions avec les numéros", () => scenario(db, async () => {
  await seed();
  assert.deepEqual(ids(await as(db, P.tres, "select id from payments")), [u(301), u(302)]);
  const ms = await as(db, P.tres, "select phone from memberships");
  assert.equal(ms.length, 4);
  assert.ok(ms.every((m) => /^237\d{9}$/.test(m.phone)));
}));

test("un membre d'un autre groupe ne voit rien de la tontine", () => scenario(db, async () => {
  await seed();
  assert.deepEqual((await as(db, P.xavier, "select name from groups")).map((r) => r.name), ["Cotisation quartier"]);
  for (const t of ["cycles", "payments", "payouts", "debts", "journal"])
    assert.equal((await as(db, P.xavier, `select * from ${t}`)).length, 0, t);
  assert.equal((await as(db, P.xavier, "select * from ordre_tours($1)", [G.tontine])).length, 0);
  assert.equal((await as(db, P.xavier, "select * from recouvrement($1)", [G.tontine])).length, 0);
}));

test("le journal : tout pour le trésorier, seulement le visible pour un membre", () => scenario(db, async () => {
  await seed();
  assert.equal((await as(db, P.tres, "select * from journal")).length, 2);
  assert.deepEqual((await as(db, P.alice, "select action from journal")).map((r) => r.action), ["tirage_au_sort"]);
}));

test("aucune écriture directe, aucune lecture des invitations", () => scenario(db, async () => {
  await seed();
  await assert.rejects(as(db, P.tres, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, declared_by)
    values ('${u(399)}','${G.tontine}','${C1}','${M.tres}',5000,'especes','${P.tres}')`), /permission denied/);
  await assert.rejects(as(db, P.tres, "update groups set amount = 1"), /permission denied/);
  await assert.rejects(as(db, P.tres, "select * from invitations"), /permission denied/);
  await assert.rejects(as(db, P.tres, "select * from login_attempts"), /permission denied/);
}));

test("ordre des tours : sans numéro, avec is_me et le bénéficiaire prévu", () => scenario(db, async () => {
  await seed();
  const rows = await as(db, P.alice, "select * from ordre_tours($1)", [G.tontine]);
  assert.deepEqual(rows.map((r) => r.display_name), ["Tina", "Alice", "Bob", "Ines"]);
  assert.ok(!("phone" in rows[0]));
  assert.deepEqual(rows.map((r) => r.is_me), [false, true, false, false]);
  assert.deepEqual(rows.map((r) => r.prevu), [true, false, false, false]);
}));

test("recouvrement : seuls les paiements validés comptent", () => scenario(db, async () => {
  await seed();
  const [r] = await as(db, P.alice, "select * from recouvrement($1)", [G.tontine]);
  assert.equal(r.membres, 4);
  assert.equal(r.attendu, 20000);
  assert.equal(r.payes, 1);
  assert.equal(r.collecte, 5000);
}));
