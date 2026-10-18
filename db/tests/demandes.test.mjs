import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc } from "../harness.mjs";
import { seedPilot, G, P } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const demander = (who = P.tres, offre = "groupe", duree = 1, moyen = "mtn_momo", ref = "MP1", g = G.tontine, precisions = null) =>
  rpc(db, who, "demander_abonnement", [g, offre, duree, moyen, ref, precisions]);
const etat = (who = P.tres, g = G.tontine) => rpc(db, who, "mon_abonnement", [g]);

test("le trésorier demande : montant calculé, une seule demande en attente, référence obligatoire", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(demander(P.tres, "groupe", 1, "orange_money", " "), /Référence de transaction obligatoire/);
  await assert.rejects(demander(P.tres, "groupe", 3), /Durée invalide : 1 ou 12 mois/);
  await assert.rejects(demander(P.tres, "pilote"), /Offre inconnue/);
  await demander(P.tres, "groupe", 12);
  const e = await etat();
  assert.equal(e.demande.statut, "en_attente");
  assert.equal(e.demande.montant, 20000);
  assert.equal(e.demande.devise, "XAF");
  await assert.rejects(demander(), /Une demande est déjà en attente pour ce groupe/);
  assert.equal((await q(`select count(*)::int n from journal where action = 'abonnement_demande' and not visible_to_members`))[0].n, 1);
}));

test("droits : membre, trésorier d'un autre groupe, anonyme", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(demander(P.alice), /Réservé aux trésoriers du groupe/);
  await assert.rejects(demander(P.xavier), /Réservé aux trésoriers du groupe/);
  await assert.rejects(etat(P.alice), /Réservé aux trésoriers du groupe/);
  await assert.rejects(rpc(db, P.tres, "admin_abonnements", []), /Réservé aux administrateurs de la plateforme/);
  await assert.rejects(rpc(db, null, "mon_abonnement", [G.tontine]), /permission denied/);
}));

test("annulation par le trésorier, puis nouvelle demande possible", () => scenario(db, async () => {
  await seedPilot(db);
  const id = await demander();
  await rpc(db, P.tres, "annuler_demande", [id]);
  await assert.rejects(rpc(db, P.tres, "annuler_demande", [id]), /Cette demande a déjà été traitée/);
  await demander();
}));

test("acceptation : offre Groupe active ; prolongation sans jour perdu", () => scenario(db, async () => {
  await seedPilot(db);
  const fin1 = await rpc(db, P.admin, "accepter_demande", [await demander()]);
  let e = await etat();
  assert.equal(e.offre, "groupe");
  assert.equal(e.demande.statut, "acceptee");
  const fin2 = await rpc(db, P.admin, "accepter_demande", [await demander(P.tres, "groupe", 12)]);
  const [{ attendu }] = await q(`select ($1::timestamptz + interval '12 months') as attendu`, [fin1]);
  assert.equal(new Date(fin2).getTime(), attendu.getTime());
  e = await etat();
  assert.equal(e.historique.length, 1);
  assert.equal(new Date(e.fin).getTime(), new Date(fin2).getTime());
}));

test("refus avec motif obligatoire, visible du trésorier", () => scenario(db, async () => {
  await seedPilot(db);
  const id = await demander();
  await assert.rejects(rpc(db, P.admin, "refuser_demande", [id, "  "]), /Motif obligatoire/);
  await rpc(db, P.admin, "refuser_demande", [id, "Référence introuvable"]);
  assert.deepEqual([(await etat()).demande.statut, (await etat()).demande.motif], ["refusee", "Référence introuvable"]);
  await assert.rejects(rpc(db, P.admin, "accepter_demande", [id]), /Cette demande a déjà été traitée/);
}));

test("Association : acceptée avec d'autres groupes, 5 au plus ; refusée pour une autre offre", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.admin, "accepter_demande", [await demander(), [G.autre]]),
    /Seule l'offre Association couvre plusieurs groupes/);
  await db.exec(`update demandes_abonnement set statut = 'annulee'`);
  await rpc(db, P.admin, "accepter_demande", [await demander(P.tres, "association", 1, "mtn_momo", "MP2", G.tontine, "et la cotisation"), [G.autre]]);
  assert.equal((await etat(P.xavier, G.autre)).offre, "association");
  const autres = [];
  for (let i = 0; i < 5; i++) {
    const [{ id }] = await q(`insert into groups(name, amount) values ($1, 1000) returning id`, [`G${i}`]);
    autres.push(id);
  }
  await assert.rejects(rpc(db, P.admin, "creer_association", [autres.concat([G.tontine]), 12]), /Choisissez de 1 à 5 groupes/);
  await rpc(db, P.admin, "creer_association", [autres, 12]);
}));

test("Pilote : fin de la journée choisie, heure de Douala ; date passée refusée", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.admin, "attribuer_pilote", [G.tontine, "2020-01-01"]), /La date de fin doit être dans le futur/);
  const fin = await rpc(db, P.admin, "attribuer_pilote", [G.tontine, "2099-01-31"]);
  assert.equal(new Date(fin).toISOString(), "2099-01-31T23:00:00.000Z");
  assert.equal((await etat()).offre, "pilote");
}));

test("prix de lancement : moitié prix, arrondi à l'unité supérieure, 50 groupes au plus", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.admin, "changer_prix_lancement", [G.tontine, true]);
  await demander(P.tres, "diaspora", 1);
  assert.deepEqual([(await etat()).demande.montant, (await etat()).demande.devise], [3, "EUR"]);
  await db.exec(`update groups set prix_lancement = true where id = '${G.autre}';
    insert into groups(name, amount, prix_lancement) select 'L' || i, 1000, true from generate_series(1, 48) i`);
  const [{ id }] = await q(`insert into groups(name, amount) values ('Le 51e', 1000) returning id`);
  await assert.rejects(rpc(db, P.admin, "changer_prix_lancement", [id, true]), /Les 50 prix de lancement sont déjà attribués/);
  await rpc(db, P.admin, "changer_prix_lancement", [G.tontine, false]);
  await rpc(db, P.admin, "changer_prix_lancement", [id, true]);
}));

test("administration : demandes en attente, groupes avec leur offre, numéros de paiement", () => scenario(db, async () => {
  await seedPilot(db);
  await demander();
  await rpc(db, P.admin, "regler_paiement", ["677000001", " ", "Olivier A."]);
  const v = await rpc(db, P.admin, "admin_abonnements", []);
  assert.equal(v.demandes.length, 1);
  assert.equal(v.demandes[0].groupe, "Tontine des amis");
  assert.equal(v.demandes[0].demandeur, "Tina");
  assert.deepEqual(v.groupes.map((g) => [g.nom, g.offre, g.membres, g.limite]),
    [["Cotisation quartier", "essai", 1, 50], ["Tontine des amis", "essai", 4, 50]]);
  assert.deepEqual(v.paiement, { mtn: "677000001", orange: null, beneficiaire: "Olivier A." });
  assert.deepEqual((await etat()).paiement, v.paiement);
  await assert.rejects(rpc(db, P.tres, "regler_paiement", ["1", "2", "3"]), /Réservé aux administrateurs de la plateforme/);
}));
