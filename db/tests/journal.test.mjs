import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, as } from "../harness.mjs";
import { seedPilot, G, P } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const journal = (uid, ...args) =>
  as(db, uid, `select * from lire_journal(${args.map((_, i) => `$${i + 1}`).join(", ")})`, args);

async function remplir() {
  await seedPilot(db);
  await db.exec(`insert into journal(group_id, actor, action, details, visible_to_members) values
    ('${G.tontine}', '${P.tres}', 'tirage_au_sort', '{"ordre":["Bob","Alice"]}', true),
    ('${G.tontine}', '${P.tres}', 'paiement_conteste', '{"nom":"Bob","montant":5000,"motif":"x"}', false),
    ('${G.tontine}', null, 'cycle_ouvert', '{"cycle":"Octobre"}', true),
    ('${G.autre}', '${P.xavier}', 'cycle_ouvert', '{"cycle":"Autre"}', true)`);
}

test("trésorier : tout le journal du groupe, du plus récent au plus ancien, avec l'auteur", () => scenario(db, async () => {
  await remplir();
  const r = await journal(P.tres, G.tontine);
  assert.deepEqual(r.map((e) => e.action), ["cycle_ouvert", "paiement_conteste", "tirage_au_sort"]);
  assert.equal(r[2].auteur, "Tina");
  assert.equal(r[0].auteur, null);
  assert.equal(r[1].visible, false);
  assert.deepEqual(r[2].details, { ordre: ["Bob", "Alice"] });
}));

test("membre : seulement les entrées visibles des membres", () => scenario(db, async () => {
  await remplir();
  assert.deepEqual((await journal(P.alice, G.tontine)).map((e) => e.action), ["cycle_ouvert", "tirage_au_sort"]);
}));

test("hors du groupe ou anonyme : refusé", () => scenario(db, async () => {
  await remplir();
  await assert.rejects(journal(P.xavier, G.tontine), /Réservé aux membres du groupe/);
  await assert.rejects(journal(null, G.tontine), /permission denied/);
}));

test("pagination : avant un identifiant, taille bornée", () => scenario(db, async () => {
  await remplir();
  const tout = await journal(P.tres, G.tontine);
  const suite = await journal(P.tres, G.tontine, Number(tout[0].id), 1);
  assert.deepEqual(suite.map((e) => e.action), ["paiement_conteste"]);
  assert.equal((await journal(P.tres, G.tontine, null, 0)).length, 1);
}));
