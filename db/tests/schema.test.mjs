import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, su } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });

const C1 = u(401);
const cycle = (id = C1, status = "ouvert") => su(db,
  `insert into cycles(id, group_id, round, number, label, amount_expected, status)
   values ('${id}','${G.tontine}',1,${id === C1 ? 1 : 2},'Octobre',5000,'${status}')`);

test("les migrations créent toutes les tables", async () => {
  const { rows } = await db.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1");
  assert.deepEqual(rows.map((r) => r.table_name), ["abonnements", "abonnements_groupes", "cycles", "debts", "demandes_abonnement", "groups", "invitations", "journal",
    "login_attempts", "memberships", "parametres_plateforme", "payments", "payouts", "people", "platform_admins"]);
});

test("un numéro mal formé est refusé", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(su(db,
    `insert into memberships(group_id, display_name, phone) values ('${G.tontine}','Zoé','0690000001')`), /check constraint/);
}));

test("un seul cycle ouvert par groupe", () => scenario(db, async () => {
  await seedPilot(db);
  await cycle();
  await assert.rejects(cycle(u(402)), /unique constraint/);
  await cycle(u(403), "clos").catch(() => assert.fail("un cycle clos ne doit pas bloquer"));
}));

test("référence obligatoire pour MoMo et Orange Money", () => scenario(db, async () => {
  await seedPilot(db); await cycle();
  await assert.rejects(su(db, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, declared_by)
    values ('${u(301)}','${G.tontine}','${C1}','${M.alice}',5000,'mtn_momo','${P.alice}')`), /check constraint/);
  await su(db, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, declared_by)
    values ('${u(302)}','${G.tontine}','${C1}','${M.alice}',5000,'especes','${P.alice}')`);
}));

test("un seul paiement non contesté par membre et par cycle", () => scenario(db, async () => {
  await seedPilot(db); await cycle();
  const pay = (id, status) => su(db, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, reference, status, declared_by)
    values ('${id}','${G.tontine}','${C1}','${M.alice}',5000,'mtn_momo','MP${id.slice(-3)}','${status}','${P.alice}')`);
  await pay(u(311), "conteste");
  await pay(u(312), "declare");
  await assert.rejects(pay(u(313), "valide"), /unique constraint/);
}));
