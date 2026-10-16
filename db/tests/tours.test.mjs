import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc, as, pgArray } from "../harness.mjs";
import { seedPilot, G, M, P } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const positions = async () => Object.fromEntries((await q(
  `select id, position from memberships where group_id = '${G.tontine}'`)).map((r) => [r.id, r.position]));
const prevu = async (c) => (await q(`select id, membership_id from payouts where cycle_id = '${c}' and status = 'prevu'`))[0];
const ouvrir = (label = "Cycle") => rpc(db, P.tres, "ouvrir_cycle", [G.tontine, label]);

test("ordonner les tours à la main, avant verrouillage seulement", () => scenario(db, async () => {
  await seedPilot(db);
  await as(db, P.tres, "select ordonner_tours($1, $2::uuid[])", [G.tontine, pgArray([M.bob, M.alice, M.tres, M.invite])]);
  assert.deepEqual(await positions(), { [M.tres]: 3, [M.alice]: 2, [M.bob]: 1, [M.invite]: 4 });
  await assert.rejects(as(db, P.tres, "select ordonner_tours($1, $2::uuid[])",
    [G.tontine, pgArray([M.bob, M.bob, M.tres, M.invite])]), /chaque membre une seule fois/);
  await assert.rejects(as(db, P.alice, "select ordonner_tours($1, $2::uuid[])",
    [G.tontine, pgArray([M.bob, M.alice, M.tres, M.invite])]), /Réservé aux trésoriers/);
  await ouvrir();
  await assert.rejects(as(db, P.tres, "select ordonner_tours($1, $2::uuid[])",
    [G.tontine, pgArray([M.tres, M.alice, M.bob, M.invite])]), /verrouillé/);
}));

test("tirage au sort : ordre complet, journal visible des membres", () => scenario(db, async () => {
  await seedPilot(db);
  const noms = await rpc(db, P.tres, "tirer_au_sort", [G.tontine]);
  assert.deepEqual([...noms].sort(), ["Alice", "Bob", "Ines", "Tina"]);
  assert.deepEqual(Object.values(await positions()).sort(), [1, 2, 3, 4]);
  assert.equal((await as(db, P.alice, "select * from journal where action = 'tirage_au_sort'")).length, 1);
  await assert.rejects(rpc(db, P.xavier, "tirer_au_sort", [G.autre]), /Réservé aux tontines/);
}));

test("échanger deux tours après verrouillage échange aussi le bénéficiaire prévu", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await ouvrir();
  await rpc(db, P.tres, "echanger_tours", [M.tres, M.bob]);
  assert.equal((await prevu(c)).membership_id, M.bob);
  const pos = await positions();
  assert.deepEqual([pos[M.tres], pos[M.bob]], [3, 1]);
  assert.equal((await as(db, P.alice, "select * from journal where action = 'tours_echanges'")).length, 1);
}));

test("remplacer le bénéficiaire puis remettre la cagnotte", () => scenario(db, async () => {
  await seedPilot(db);
  const c = await ouvrir();
  const p = await prevu(c);
  await rpc(db, P.tres, "remplacer_beneficiaire", [p.id, M.alice]);
  assert.equal((await prevu(c)).membership_id, M.alice);
  await assert.rejects(rpc(db, P.tres, "enregistrer_remise", [p.id, 19000, "mtn_momo", ""]), /Référence/);
  assert.deepEqual(await rpc(db, P.tres, "enregistrer_remise", [p.id, 19000, "mtn_momo", "MP55"]), { ecart: -1000 });
  await assert.rejects(rpc(db, P.tres, "enregistrer_remise", [p.id, 19000, "especes"]), /déjà remise/);
  await assert.rejects(rpc(db, P.tres, "echanger_tours", [M.alice, M.bob]), /déjà reçu sa part/);
}));

test("tour complet : 4 cycles, puis nouveau tour", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.tres, "nouveau_tour", [G.tontine]), /pas terminé/);
  for (let i = 1; i <= 4; i++) {
    const c = await ouvrir(`Cycle ${i}`);
    await rpc(db, P.tres, "enregistrer_remise", [(await prevu(c)).id, 20000, "especes"]);
    await rpc(db, P.tres, "clore_cycle", [c]);
  }
  await assert.rejects(ouvrir("Cycle 5"), /Tour terminé/);
  assert.equal((await q(`select count(*)::int n from cycles where group_id = '${G.tontine}'`))[0].n, 4);
  assert.equal(await rpc(db, P.tres, "nouveau_tour", [G.tontine]), 2);
  assert.equal((await q(`select order_locked from groups where id = '${G.tontine}'`))[0].order_locked, false);
  const c = await ouvrir("Tour 2, cycle 1");
  assert.deepEqual(await q(`select round, number from cycles where id = '${c}'`), [{ round: 2, number: 1 }]);
  assert.equal((await prevu(c)).membership_id, M.tres);
}));
