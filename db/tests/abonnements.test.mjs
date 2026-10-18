import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const offre = async (g = G.tontine) => (await q(`select * from offre_en_vigueur($1)`, [g]))[0];
const vieillir = (jours, g = G.tontine) => db.exec(`update groups set created_at = now() - interval '${jours} days' where id = '${g}'`);
async function abonner(offreCode, debut, fin, groupes = [G.tontine]) {
  const [{ id }] = await q(`insert into abonnements(offre, debut, fin) values ($1, now() + $2::interval, now() + $3::interval) returning id`,
    [offreCode, debut, fin]);
  for (const g of groupes) await q(`insert into abonnements_groupes values ($1, $2)`, [id, g]);
  return id;
}
/** Ajoute n membres invités à la tontine (qui en compte déjà 4). */
async function ajouter(n, debut = 10) {
  for (let i = 0; i < n; i++) await rpc(db, P.tres, "ajouter_membre", [G.tontine, `Membre ${debut + i}`, `6910000${String(debut + i).padStart(2, "0")}`]);
}

test("groupe neuf : essai de 30 jours, 50 membres", () => scenario(db, async () => {
  await seedPilot(db);
  const o = await offre();
  assert.equal(o.offre, "essai");
  assert.equal(o.limite, 50);
  const [{ attendu }] = await q(`select created_at + interval '30 days' as attendu from groups where id = $1`, [G.tontine]);
  assert.equal(o.fin.getTime(), attendu.getTime());
}));

test("après 30 jours sans abonnement : Découverte, 10 membres, sans date de fin", () => scenario(db, async () => {
  await seedPilot(db); await vieillir(31);
  assert.deepEqual({ ...(await offre()) }, { offre: "decouverte", limite: 10, fin: null });
}));

test("Pilote en cours, puis offre payante qui l'emporte, puis retour à Découverte quand tout est échu", () => scenario(db, async () => {
  await seedPilot(db); await vieillir(60);
  await abonner("pilote", "-1 day", "10 days");
  assert.equal((await offre()).offre, "pilote");
  await abonner("association", "-1 day", "5 days", [G.tontine, G.autre]);
  assert.equal((await offre()).offre, "association");
  assert.equal((await offre(G.autre)).offre, "association");
  await db.exec(`update abonnements set fin = now() - interval '1 hour', debut = now() - interval '2 days'`);
  assert.equal((await offre()).offre, "decouverte");
}));

test("Découverte : le 11e membre est refusé avec le message de l'offre", () => scenario(db, async () => {
  await seedPilot(db); await vieillir(31);
  await ajouter(6);                       // 4 + 6 = 10
  await assert.rejects(ajouter(1, 30),
    /Limite de l'offre Découverte atteinte \(10 membres\) : passez à l'offre Groupe dans l'onglet Abonnement/);
}));

test("offres à 50 : le message de limite reste celui du maximum du groupe", () => scenario(db, async () => {
  await seedPilot(db);
  await db.exec(`update groups set max_members = 4 where id = '${G.tontine}'`);
  await assert.rejects(ajouter(1), /Nombre maximum de membres atteint \(4\)/);
}));

test("fin d'essai au-dessus de la limite : pas de nouveau cycle, mais tout le reste continue", () => scenario(db, async () => {
  await seedPilot(db);
  await ajouter(8);                       // 12 membres pendant l'essai
  const c = await rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Octobre"]);
  await vieillir(31);
  await rpc(db, P.tres, "saisir_especes", [u(901), M.alice, c, 5000]);   // encaissement permis malgré le blocage
  await rpc(db, P.tres, "clore_cycle", [c]);                             // clôture permise aussi
  await assert.rejects(rpc(db, P.tres, "ouvrir_cycle", [G.tontine, "Novembre"]),
    /Votre groupe compte 12 membres, l'offre Découverte en permet 10 : choisissez une offre dans l'onglet Abonnement/);
  await assert.rejects(ajouter(1, 40), /Limite de l'offre Découverte atteinte/);
}));

test("reprise : chaque groupe sans abonnement reçoit l'offre Pilote, une seule fois", () => scenario(db, async () => {
  await seedPilot(db); await vieillir(90); await vieillir(90, G.autre);
  assert.equal((await q(`select reprendre_groupes_pilote('2027-02-01 00:00:00+01') as n`))[0].n, 2);
  assert.equal((await q(`select reprendre_groupes_pilote('2027-02-01 00:00:00+01') as n`))[0].n, 0);
  const o = await offre();
  assert.equal(o.offre, "pilote");
  assert.equal(o.fin.toISOString(), "2027-01-31T23:00:00.000Z");
}));

test("schéma : prix de lancement faux par défaut, ancienne colonne plan retirée, tables fermées à l'application", () => scenario(db, async () => {
  await seedPilot(db);
  assert.equal((await q(`select prix_lancement from groups where id = $1`, [G.tontine]))[0].prix_lancement, false);
  assert.equal((await q(`select count(*)::int n from information_schema.columns where table_name = 'groups' and column_name = 'plan'`))[0].n, 0);
  assert.equal((await q(`select count(*)::int n from information_schema.role_table_grants
    where table_name in ('abonnements','abonnements_groupes','parametres_plateforme') and grantee in ('anon','authenticated')`))[0].n, 0);
}));
