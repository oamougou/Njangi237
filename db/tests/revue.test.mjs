// Correctifs issus de la relecture finale du lot 1 (dettes, cycle clos, retrait d'un membre)
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc, su } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const ouvrir = (label = "Octobre") => rpc(db, P.tres, "ouvrir_cycle", [G.tontine, label]);
const dette = async (m) => (await q(`select id from debts where membership_id = '${m}' and settled_at is null`))[0].id;

test("valider refuse un paiement ordinaire arrivé dans un cycle déjà clos", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await ouvrir();
  await rpc(db, P.tres, "clore_cycle", [c]);
  // Déclaration arrivée pendant la clôture (course entre deux sessions)
  await su(db, `insert into payments(id, group_id, cycle_id, membership_id, amount, method, status, declared_by)
    values ('${u(301)}','${G.tontine}','${c}','${M.alice}',5000,'especes','declare','${P.alice}')`);
  await assert.rejects(rpc(db, P.tres, "valider_paiement", [u(301)]), /Ce cycle est clos/);
  await rpc(db, P.tres, "contester_paiement", [u(301), "Arrivé après la clôture : à régler comme dette"]);
  assert.equal((await q(`select status from payments where id = '${u(301)}'`))[0].status, "conteste");
}));

test("un règlement de dette doit couvrir toute la dette", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await ouvrir();
  await rpc(db, P.tres, "clore_cycle", [c]);
  const d = await dette(M.alice);
  await assert.rejects(rpc(db, P.alice, "declarer_paiement", [u(301), c, 100, "especes", null, null, d]), /couvrir toute la dette/);
  await assert.rejects(rpc(db, P.tres, "saisir_especes", [u(302), M.alice, c, 100, null, d]), /couvrir toute la dette/);
  assert.equal((await q(`select settled_at from debts where id = '${d}'`))[0].settled_at, null);
}));

test("la dette d'un membre retiré peut encore être réglée en espèces", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await ouvrir();
  await rpc(db, P.tres, "clore_cycle", [c]);
  const d = await dette(M.bob);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  await rpc(db, P.tres, "saisir_especes", [u(301), M.bob, c, 5000, null, d]);
  assert.ok((await q(`select settled_at from debts where id = '${d}'`))[0].settled_at);
  await assert.rejects(rpc(db, P.tres, "saisir_especes", [u(302), M.bob, c, 5000]), /Ce cycle est clos|retiré/);
}));

test("le retrait d'un membre déjà servi enregistre ce qu'il doit encore", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await ouvrir();
  const [{ id: payout }] = await q(`select id from payouts where cycle_id = '${c}'`);
  await rpc(db, P.tres, "enregistrer_remise", [payout, 20000, "especes"]);   // Tina « bouffe »
  await rpc(db, P.tres, "clore_cycle", [c]);                                  // dette de 5 000 pour chacun
  await rpc(db, P.tres, "changer_role", [M.alice, "tresorier"]);
  // Restent Alice, Bob, Ines à servir : 3 cycles de 5 000 ; plus sa dette de 5 000
  assert.deepEqual(await rpc(db, P.alice, "retirer_membre", [M.tres]),
    { deja_servi: true, cycles_restants: 3, montant_restant: 15000, dettes: 5000 });
  assert.equal((await q(`select left_balance from memberships where id = '${M.tres}'`))[0].left_balance, 15000);
  const [j] = await q(`select details, visible_to_members from journal where action = 'solde_depart'`);
  assert.equal(j.details.montant_restant, 15000);
  assert.equal(j.visible_to_members, false);
}));
