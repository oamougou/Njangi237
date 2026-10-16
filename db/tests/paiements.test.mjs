import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc, as } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const status = async (id) => (await q(`select status from payments where id = '${id}'`))[0]?.status;
const ouvrir = () => rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
const declarer = (who, id, c, amount = 5000, method = "mtn_momo", ref = "MP1", debt = null) =>
  rpc(db, who, "declarer_paiement", [id, c, amount, method, ref, null, debt]);

test("déclaration par un membre puis validation par le trésorier", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  assert.deepEqual(await declarer(P.alice, u(301), c), { ok: true, duplicate: false, status: "declare" });
  await assert.rejects(rpc(db, P.alice, "valider_paiement", [u(301)]), /Réservé aux trésoriers/);
  await rpc(db, P.tres, "valider_paiement", [u(301)]);
  assert.equal(await status(u(301)), "valide");
  await assert.rejects(rpc(db, P.tres, "valider_paiement", [u(301)]), /pas en attente de validation/);
}));

test("rejouer une déclaration (file hors ligne) ne crée pas de doublon", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await declarer(P.alice, u(301), c);
  assert.deepEqual(await declarer(P.alice, u(301), c), { ok: true, duplicate: true, status: "declare" });
  assert.equal((await q(`select count(*)::int n from payments`))[0].n, 1);
  await assert.rejects(declarer(P.alice, u(302), c), /déjà enregistré pour ce cycle/);
  await assert.rejects(declarer(P.bob, u(301), c), /Identifiant de paiement déjà utilisé/);
}));

test("saisies invalides et personnes non autorisées", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await assert.rejects(declarer(P.alice, u(301), c, 5000, "mtn_momo", " "), /Référence de transaction obligatoire/);
  await assert.rejects(declarer(P.alice, u(301), c, 0), /Montant invalide/);
  await assert.rejects(declarer(P.xavier, u(301), c), /pas membre de ce groupe/);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  await assert.rejects(declarer(P.bob, u(302), c), /pas membre de ce groupe/);
}));

test("un paiement contesté libère la place : le membre redéclare", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await declarer(P.bob, u(301), c, 5000, "orange_money", "OM9");
  await assert.rejects(rpc(db, P.tres, "contester_paiement", [u(301), "  "]), /Motif obligatoire/);
  await rpc(db, P.tres, "contester_paiement", [u(301), "Référence introuvable chez Orange"]);
  assert.equal(await status(u(301)), "conteste");
  assert.equal((await as(db, P.tres, "select count(*)::int n from journal where action = 'paiement_conteste'"))[0].n, 1);
  assert.equal((await declarer(P.bob, u(302), c, 5000, "orange_money", "OM10")).status, "declare");
}));

test("espèces saisies par le trésorier : validées d'office, même pour un invité sans compte", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  assert.deepEqual(await rpc(db, P.tres, "saisir_especes", [u(301), M.invite, c, 5000]),
    { ok: true, duplicate: false, status: "valide" });
  assert.deepEqual(await rpc(db, P.tres, "saisir_especes", [u(301), M.invite, c, 5000]),
    { ok: true, duplicate: true, status: "valide" });
  await assert.rejects(rpc(db, P.alice, "saisir_especes", [u(302), M.alice, c, 5000]), /Réservé aux trésoriers/);
  await assert.rejects(rpc(db, P.xavier, "saisir_especes", [u(303), M.xavier, c, 5000]), /Cycle introuvable/);
}));

test("dette : réglée par une déclaration validée, sans toucher au cycle en cours", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await rpc(db, P.tres, "clore_cycle", [c]);
  const [{ id: dette }] = await q(`select id from debts where membership_id = '${M.bob}' and cycle_id = '${c}'`);
  await assert.rejects(declarer(P.bob, u(301), c), /Ce cycle est clos/);
  await declarer(P.bob, u(302), c, 5000, "mtn_momo", "MP7", dette);
  await rpc(db, P.tres, "valider_paiement", [u(302)]);
  assert.ok((await q(`select settled_at from debts where id = '${dette}'`))[0].settled_at);
  const [r] = await as(db, P.bob, "select * from recouvrement($1)", [G.tontine]);
  assert.equal(r.collecte, 0);
  await assert.rejects(declarer(P.alice, u(303), c, 5000, "mtn_momo", "MP8", dette), /Dette introuvable/);
}));

test("contester un règlement de dette validé rouvre la dette", () => scenario(db, async () => {
  await seedPilot(db); const c = await ouvrir();
  await rpc(db, P.tres, "clore_cycle", [c]);
  const [{ id: dette }] = await q(`select id from debts where membership_id = '${M.bob}'`);
  await rpc(db, P.tres, "saisir_especes", [u(301), M.bob, c, 5000, null, dette]);
  assert.ok((await q(`select settled_at from debts where id = '${dette}'`))[0].settled_at);
  await rpc(db, P.tres, "contester_paiement", [u(301), "Billets refusés"]);
  assert.equal((await q(`select settled_at from debts where id = '${dette}'`))[0].settled_at, null);
}));
