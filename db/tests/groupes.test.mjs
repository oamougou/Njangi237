import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, as, rpc } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;

test("normalisation des numéros saisis à la camerounaise", () => scenario(db, async () => {
  for (const s of ["6 90 00 00 07", "+237 690 00 00 07", "00237690000007", "237-690-000-007"])
    assert.equal((await q(`select normaliser_telephone('${s}') n`))[0].n, "237690000007", s);
  await assert.rejects(db.query("select normaliser_telephone('12345')"), /Numéro de téléphone invalide/);
}));

test("l'administrateur crée un groupe et son trésorier invité", () => scenario(db, async () => {
  await seedPilot(db);
  const r = await rpc(db, P.admin, "creer_groupe",
    ["Njangi du lundi", "tontine", 10000, "hebdomadaire", 2, "Paul", "699 11 22 33"]);
  const [m] = await q(`select role, status, position, phone from memberships where id = '${r.membership_id}'`);
  assert.deepEqual(m, { role: "tresorier", status: "invite", position: 1, phone: "237699112233" });
  assert.equal((await q(`select count(*)::int n from journal where group_id = '${r.group_id}' and action = 'groupe_cree'`))[0].n, 1);
}));

test("seul un administrateur de la plateforme crée un groupe", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.tres, "creer_groupe", ["X", "tontine", 1000, "mensuelle", 1, "Y", "690000077"]),
    /Réservé aux administrateurs/);
  await assert.rejects(rpc(db, P.admin, "creer_groupe", ["X", "tontine", 0, "mensuelle", 1, "Y", "690000077"]),
    /Montant invalide/);
}));

test("le trésorier ajoute un membre ; doublon et non-trésorier refusés", () => scenario(db, async () => {
  await seedPilot(db);
  const id = await rpc(db, P.tres, "ajouter_membre", [G.tontine, "Jean", "677 00 00 01"]);
  const [m] = await q(`select status, position, role from memberships where id = '${id}'`);
  assert.deepEqual(m, { status: "invite", position: 5, role: "membre" });
  await assert.rejects(rpc(db, P.tres, "ajouter_membre", [G.tontine, "Jean bis", "+237677000001"]), /déjà dans le groupe/);
  await assert.rejects(rpc(db, P.alice, "ajouter_membre", [G.tontine, "Luc", "677000002"]), /Réservé aux trésoriers/);
}));

test("un membre retiré peut être réintégré avec la même adhésion", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  const id = await rpc(db, P.tres, "ajouter_membre", [G.tontine, "Bob", "690000004"]);
  assert.equal(id, M.bob);
  assert.equal((await q(`select status from memberships where id = '${M.bob}'`))[0].status, "invite");
}));

test("nombre maximum de membres", () => scenario(db, async () => {
  await seedPilot(db);
  await db.exec(`update groups set max_members = 4 where id = '${G.tontine}'`);
  await assert.rejects(rpc(db, P.tres, "ajouter_membre", [G.tontine, "Jean", "677000001"]), /maximum de membres/);
}));

test("le dernier trésorier ne peut ni se rétrograder ni se retirer", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.tres, "changer_role", [M.tres, "membre"]), /au moins un trésorier actif/);
  await assert.rejects(rpc(db, P.tres, "retirer_membre", [M.tres]), /au moins un trésorier actif/);
  await rpc(db, P.tres, "changer_role", [M.alice, "tresorier"]);
  await rpc(db, P.tres, "changer_role", [M.tres, "membre"]);
  assert.equal((await q(`select role from memberships where id = '${M.tres}'`))[0].role, "membre");
}));

test("retrait d'un membre : statut, position libérée, journal visible", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  const [m] = await q(`select status, position, left_at is not null as parti from memberships where id = '${M.bob}'`);
  assert.deepEqual(m, { status: "retire", position: null, parti: true });
  assert.equal((await as(db, P.alice, "select action from journal where action = 'membre_retire'")).length, 1);
  await assert.rejects(rpc(db, P.tres, "retirer_membre", [M.bob]), /déjà retiré/);
}));

test("aperçu du retrait d'un membre déjà servi, et bénéficiaire en cours protégé", () => scenario(db, async () => {
  await seedPilot(db);
  const C1 = u(401), C2 = u(402);
  await db.exec(`
    insert into cycles(id, group_id, round, number, label, amount_expected, status) values
      ('${C1}','${G.tontine}',1,1,'Sept',5000,'clos'), ('${C2}','${G.tontine}',1,2,'Oct',5000,'ouvert');
    insert into payouts(group_id, cycle_id, round, membership_id, amount_expected, amount, method, paid_on, status) values
      ('${G.tontine}','${C1}',1,'${M.alice}',20000,20000,'especes',current_date,'remis');
    insert into payouts(group_id, cycle_id, round, membership_id, amount_expected) values ('${G.tontine}','${C2}',1,'${M.bob}',20000);`);
  // Alice a « bouffé » ; restent Tina et Ines (2 cycles) + le cycle ouvert qu'elle n'a pas payé = 3
  assert.deepEqual(await rpc(db, P.tres, "apercu_retrait", [M.alice]),
    { deja_servi: true, cycles_restants: 3, montant_restant: 15000, dettes: 0 });
  await assert.rejects(rpc(db, P.tres, "retirer_membre", [M.bob]), /bénéficiaire du cycle en cours/);
}));
