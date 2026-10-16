import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, scenario, rpc, svc, as } from "../harness.mjs";
import { seedPilot, G, M, P, u } from "../fixtures.mjs";

let db;
before(async () => { db = await freshDb(); });
const q = async (sql) => (await db.query(sql)).rows;
const H = (n) => String(n).repeat(64).slice(0, 64);          // empreinte factice : "aaaa…", "bbbb…"
const nouveauCompte = async (id, phone) => db.exec(`insert into auth.users(id, email) values ('${id}','${phone}@njangi237.local')`);

test("le trésorier invite un membre ; seule l'empreinte est stockée", () => scenario(db, async () => {
  await seedPilot(db);
  const r = await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  assert.equal(r.groupe, "Tontine des amis");
  assert.equal(r.nom, "Ines");
  assert.equal(r.phone, "237690000009");
  const [i] = await q(`select kind, token_hash, expires_at > now() + interval '6 days' as sept_jours from invitations`);
  assert.deepEqual(i, { kind: "invitation", token_hash: H("a"), sept_jours: true });
}));

test("inviter : refus pour un non-trésorier, une empreinte mal formée, un membre déjà actif", () => scenario(db, async () => {
  await seedPilot(db);
  await assert.rejects(rpc(db, P.alice, "inviter", [M.invite, H("a")]), /Réservé aux trésoriers/);
  await assert.rejects(rpc(db, P.tres, "inviter", [M.invite, "pas-une-empreinte"]), /Jeton invalide/);
  await assert.rejects(rpc(db, P.tres, "inviter", [M.alice, H("a")]), /déjà rejoint/);
  await assert.rejects(rpc(db, P.tres, "inviter", [M.invite, H("b"), "reinitialisation"]), /pas encore de compte/);
}));

test("l'administrateur invite le premier trésorier d'un groupe qu'il vient de créer, pas un simple membre", () => scenario(db, async () => {
  await seedPilot(db);
  const g = await rpc(db, P.admin, "creer_groupe", ["Njangi du lundi", "tontine", 10000, "hebdomadaire", 1, "Paul", "699112233"]);
  assert.equal((await rpc(db, P.admin, "inviter", [g.membership_id, H("a")])).nom, "Paul");
  await assert.rejects(rpc(db, P.admin, "inviter", [M.invite, H("b")]), /Réservé aux trésoriers/);
}));

test("un nouveau lien remplace le précédent", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  await rpc(db, P.tres, "inviter", [M.invite, H("b")]);
  await assert.rejects(svc(db, "lire_invitation", [H("a")]), /Lien invalide ou expiré/);
  assert.equal((await svc(db, "lire_invitation", [H("b")])).nom, "Ines");
}));

test("lire l'invitation : réservé au service, sans compte existant", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  await assert.rejects(rpc(db, P.alice, "lire_invitation", [H("a")]), /permission denied/);
  const info = await svc(db, "lire_invitation", [H("a")]);
  assert.deepEqual({ ...info, membership_id: undefined }, { kind: "invitation", membership_id: undefined, groupe: "Tontine des amis",
    invite_par: "Tina", nom: "Ines", phone: "237690000009", compte_existant: false, person_id: null });
  await assert.rejects(svc(db, "lire_invitation", [H("z")]), /Lien invalide ou expiré/);
}));

test("accepter avec un nouveau compte : personne créée, adhésion active, lien à usage unique", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  await nouveauCompte(u(9), "237690000009");
  assert.deepEqual(await svc(db, "finaliser_invitation", [H("a"), u(9), "Inès Ngo"]), { group_id: G.tontine });
  assert.deepEqual(await q(`select full_name, phone from people where id = '${u(9)}'`), [{ full_name: "Inès Ngo", phone: "237690000009" }]);
  assert.deepEqual(await q(`select status, person_id from memberships where id = '${M.invite}'`), [{ status: "actif", person_id: u(9) }]);
  assert.equal((await as(db, P.alice, "select * from journal where action = 'membre_rejoint'")).length, 1);
  await assert.rejects(svc(db, "finaliser_invitation", [H("a"), u(9), null]), /Lien invalide ou expiré/);
}));

test("accepter avec un compte existant (membre réintégré)", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "retirer_membre", [M.bob]);
  await rpc(db, P.tres, "ajouter_membre", [G.tontine, "Bob", "690000004"]);
  await rpc(db, P.tres, "inviter", [M.bob, H("a")]);
  const info = await svc(db, "lire_invitation", [H("a")]);
  assert.equal(info.compte_existant, true);
  assert.equal(info.person_id, P.bob);
  await svc(db, "finaliser_invitation", [H("a"), P.bob, null]);
  assert.equal((await q(`select status from memberships where id = '${M.bob}'`))[0].status, "actif");
}));

test("un lien ne peut pas servir à un compte d'un autre numéro", () => scenario(db, async () => {
  await seedPilot(db);
  await rpc(db, P.tres, "inviter", [M.invite, H("a")]);
  await assert.rejects(svc(db, "finaliser_invitation", [H("a"), P.alice, null]), /autre numéro/);
}));

test("PIN oublié : lien de 24 h, usage unique, blocage remis à zéro", () => scenario(db, async () => {
  await seedPilot(db);
  await db.exec(`insert into login_attempts(phone, failures) values ('237690000003', 3)`);
  await rpc(db, P.tres, "inviter", [M.alice, H("a"), "reinitialisation"]);
  const info = await svc(db, "lire_invitation", [H("a")]);
  assert.equal(info.kind, "reinitialisation");
  assert.equal(info.person_id, P.alice);
  assert.deepEqual(await svc(db, "finaliser_nouveau_pin", [H("a")]), { person_id: P.alice, phone: "237690000003" });
  assert.equal((await q(`select count(*)::int n from login_attempts`))[0].n, 0);
  await assert.rejects(svc(db, "finaliser_nouveau_pin", [H("a")]), /Lien invalide ou expiré/);
  await rpc(db, P.tres, "inviter", [M.alice, H("b"), "reinitialisation"]);
  await assert.rejects(svc(db, "finaliser_invitation", [H("b"), P.alice, null]), /Lien invalide ou expiré/);
}));

test("blocage après 5 PIN faux, levé par une connexion réussie", () => scenario(db, async () => {
  const tel = "237690000003";
  for (let i = 1; i <= 4; i++) assert.deepEqual(await svc(db, "enregistrer_echec", [tel]), { echecs: i, bloque_jusqu: null });
  assert.equal(await svc(db, "verifier_blocage", [tel]), null);
  const r = await svc(db, "enregistrer_echec", [tel]);
  assert.ok(r.bloque_jusqu);
  assert.ok(await svc(db, "verifier_blocage", [tel]));
  await svc(db, "enregistrer_succes", [tel]);
  assert.equal(await svc(db, "verifier_blocage", [tel]), null);
}));

test("un blocage expiré repart de zéro", () => scenario(db, async () => {
  const tel = "237690000003";
  await db.exec(`insert into login_attempts(phone, failures, locked_until) values ('${tel}', 0, now() - interval '1 minute')`);
  assert.equal(await svc(db, "verifier_blocage", [tel]), null);
  assert.deepEqual(await svc(db, "enregistrer_echec", [tel]), { echecs: 1, bloque_jusqu: null });
}));
