import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { traiter } from "./logique.ts";
import { ErreurMetier } from "./http.ts";
import { genererJeton, hashJeton } from "./jeton.ts";
import type { Deps, InfoInvitation, Session } from "./types.ts";

const SESSION: Session = { access_token: "a", refresh_token: "r", expires_at: 1, user_id: "u-existant" };
const INFO: InfoInvitation = { kind: "invitation", membership_id: "m1", groupe: "Tontine des amis", invite_par: "Tina",
  nom: "Ines", phone: "237690000009", compte_existant: false, person_id: null };

/** Dépendances simulées : chaque appel est noté ; rpc renvoie la valeur (ou l'erreur) prévue pour la fonction. */
function faux(o: { rpc?: Record<string, unknown>; session?: Session | null; creerErreur?: Error } = {}) {
  const appels: [string, unknown][] = [];
  const deps: Deps = {
    rpc: async (fn, args) => { appels.push([fn, args]); const r = o.rpc?.[fn]; if (r instanceof Error) throw r; return r ?? null; },
    creerCompte: async (email) => { appels.push(["creerCompte", email]); if (o.creerErreur) throw o.creerErreur; return "u-nouveau"; },
    supprimerCompte: async (id) => { appels.push(["supprimerCompte", id]); },
    changerPin: async (id) => { appels.push(["changerPin", id]); },
    ouvrirSession: async (email) => { appels.push(["ouvrirSession", email]); return o.session === undefined ? SESSION : o.session; },
  };
  return { deps, appels, noms: () => appels.map(([n]) => n) };
}
const statut = async (p: Promise<unknown>, status: number, msg: string) => {
  const e = await assertRejects(() => p, ErreurMetier, msg);
  assertEquals(e.status, status);
};
const jeton = genererJeton();

Deno.test("aperçu : informations publiques du lien, sans le numéro", async () => {
  const f = faux({ rpc: { lire_invitation: INFO } });
  const r = await traiter({ action: "apercu", jeton }, f.deps);
  assertEquals(r, { type: "invitation", groupe: "Tontine des amis", invite_par: "Tina", nom: "Ines", compte_existant: false });
  assertEquals(f.appels[0], ["lire_invitation", { p_token_hash: await hashJeton(jeton) }]);
});

Deno.test("jeton malformé : refusé sans interroger la base", async () => {
  const f = faux();
  await statut(traiter({ action: "apercu", jeton: "abc" }, f.deps), 404, "Lien invalide ou expiré");
  assertEquals(f.appels.length, 0);
});

Deno.test("accepter avec un nouveau compte", async () => {
  const f = faux({ rpc: { lire_invitation: INFO, finaliser_invitation: { group_id: "g1" } } });
  const r = await traiter({ action: "accepter", jeton, pin: "123456", nom: "Inès" }, f.deps);
  assertEquals(r, { session: SESSION });
  assertEquals(f.noms(), ["lire_invitation", "creerCompte", "finaliser_invitation", "ouvrirSession"]);
  assertEquals(f.appels[1][1], "237690000009@njangi237.local");
  assertEquals(f.appels[2][1], { p_token_hash: await hashJeton(jeton), p_person: "u-nouveau", p_full_name: "Inès" });
});

Deno.test("finalisation refusée : le compte Auth tout juste créé est supprimé", async () => {
  const f = faux({ rpc: { lire_invitation: INFO, finaliser_invitation: new ErreurMetier("Lien invalide ou expiré", 404) } });
  await statut(traiter({ action: "accepter", jeton, pin: "123456" }, f.deps), 404, "Lien invalide ou expiré");
  assertEquals(f.noms(), ["lire_invitation", "creerCompte", "finaliser_invitation", "supprimerCompte"]);
  assertEquals(f.appels[3][1], "u-nouveau");
});

Deno.test("compte existant : le PIN est vérifié, aucun second compte", async () => {
  const f = faux({ rpc: { lire_invitation: { ...INFO, compte_existant: true, person_id: "u-existant" }, finaliser_invitation: {} } });
  await traiter({ action: "accepter", jeton, pin: "123456" }, f.deps);
  assertEquals(f.noms(), ["lire_invitation", "verifier_blocage", "ouvrirSession", "enregistrer_succes", "finaliser_invitation"]);
  assertEquals((f.appels[4][1] as { p_person: string }).p_person, "u-existant");
});

Deno.test("compte existant, PIN faux : compté dans le blocage, rien n'est finalisé", async () => {
  const f = faux({ session: null, rpc: { lire_invitation: { ...INFO, compte_existant: true, person_id: "u-existant" },
    enregistrer_echec: { echecs: 1, bloque_jusqu: null } } });
  await statut(traiter({ action: "accepter", jeton, pin: "000000" }, f.deps), 401, "Numéro ou PIN incorrect");
  assertEquals(f.noms(), ["lire_invitation", "verifier_blocage", "ouvrirSession", "enregistrer_echec"]);
});

Deno.test("PIN mal formé : refusé avant toute création", async () => {
  const f = faux({ rpc: { lire_invitation: INFO } });
  await statut(traiter({ action: "accepter", jeton, pin: "12" }, f.deps), 400, "Le PIN doit contenir 6 chiffres");
  assertEquals(f.noms(), ["lire_invitation"]);
});

Deno.test("nouveau PIN : mot de passe changé, lien consommé, session ouverte", async () => {
  const f = faux({ rpc: { lire_invitation: { ...INFO, kind: "reinitialisation", compte_existant: true, person_id: "u-existant" },
    finaliser_nouveau_pin: {} } });
  assertEquals(await traiter({ action: "nouveau_pin", jeton, pin: "654321" }, f.deps), { session: SESSION });
  assertEquals(f.noms(), ["lire_invitation", "changerPin", "finaliser_nouveau_pin", "ouvrirSession"]);
  assertEquals(f.appels[1][1], "u-existant");
});

Deno.test("un lien d'invitation ne sert pas à changer de PIN, et inversement", async () => {
  await statut(traiter({ action: "nouveau_pin", jeton, pin: "654321" }, faux({ rpc: { lire_invitation: INFO } }).deps),
    404, "Lien invalide ou expiré");
  await statut(traiter({ action: "accepter", jeton, pin: "654321" },
    faux({ rpc: { lire_invitation: { ...INFO, kind: "reinitialisation" } } }).deps), 404, "Lien invalide ou expiré");
});

Deno.test("connexion : numéro normalisé, succès enregistré", async () => {
  const f = faux();
  assertEquals(await traiter({ action: "connexion", telephone: "+237 6 90 00 00 02", pin: "123456" }, f.deps), { session: SESSION });
  assertEquals(f.appels, [["verifier_blocage", { p_phone: "237690000002" }], ["ouvrirSession", "237690000002@njangi237.local"],
    ["enregistrer_succes", { p_phone: "237690000002" }]]);
});

Deno.test("connexion bloquée : aucune tentative tant que le blocage dure", async () => {
  const f = faux({ rpc: { verifier_blocage: "2026-10-16T12:00:00Z" } });
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "123456" }, f.deps), 429, "Trop d'essais : réessayez après 13:00");
  assertEquals(f.noms(), ["verifier_blocage"]);
});

Deno.test("cinquième PIN faux : le blocage est annoncé", async () => {
  const f = faux({ session: null, rpc: { enregistrer_echec: { echecs: 0, bloque_jusqu: "2026-10-16T12:15:00Z" } } });
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "000000" }, f.deps), 429, "Trop d'essais : réessayez après 13:15");
});

Deno.test("connexion : numéro ou PIN mal formé, action inconnue", async () => {
  await statut(traiter({ action: "connexion", telephone: "12", pin: "123456" }, faux().deps), 400, "Numéro de téléphone invalide");
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "12" }, faux().deps), 401, "Numéro ou PIN incorrect");
  await statut(traiter({ action: "pirater" }, faux().deps), 400, "Action inconnue");
});
