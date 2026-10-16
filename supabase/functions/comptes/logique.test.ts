import { assert, assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { traiter } from "./logique.ts";
import { ErreurMetier } from "./http.ts";
import { genererJeton, hashJeton } from "./jeton.ts";
import { motDePasse } from "./secret.ts";
import type { Deps, InfoInvitation, Session } from "./types.ts";

const POIVRE = "poivre-de-test";
const SESSION: Session = { access_token: "a", refresh_token: "r", expires_at: 1, user_id: "u-existant" };
const INFO: InfoInvitation = { kind: "invitation", membership_id: "m1", groupe: "Tontine des amis", invite_par: "Tina",
  nom: "Ines", phone: "237690000009", compte_existant: false, person_id: null };
const AUTORISE = { autorise: true, bloque_jusqu: null };

type Options = {
  rpc?: Record<string, unknown | ((args: Record<string, unknown>) => unknown)>;
  session?: Session | null | Error;
  creerErreur?: Error;
  utilisateur?: { id: string; email: string } | null;
};

/** Dépendances simulées : chaque appel est noté avec ses arguments (mot de passe compris). */
function faux(o: Options = {}) {
  const appels: [string, ...unknown[]][] = [];
  const deps: Deps = {
    poivre: POIVRE,
    telephoneAmorce: "237676774643",
    rpc: async (fn, args) => {
      appels.push([fn, args]);
      const r = o.rpc?.[fn] ?? (fn === "reserver_essai" ? AUTORISE : null);
      if (r instanceof Error) throw r;
      return typeof r === "function" ? r(args) : r;
    },
    creerCompte: async (email, mdp) => { appels.push(["creerCompte", email, mdp]); if (o.creerErreur) throw o.creerErreur; return "u-nouveau"; },
    supprimerCompte: async (id) => { appels.push(["supprimerCompte", id]); },
    changerMotDePasse: async (id, mdp) => { appels.push(["changerMotDePasse", id, mdp]); },
    ouvrirSession: async (email, mdp) => {
      appels.push(["ouvrirSession", email, mdp]);
      if (o.session instanceof Error) throw o.session;
      return o.session === undefined ? SESSION : o.session;
    },
    utilisateur: async (jwt) => { appels.push(["utilisateur", jwt]); return o.utilisateur === undefined ? null : o.utilisateur; },
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

Deno.test("le mot de passe Auth n'est jamais le PIN : il est dérivé avec la clé du serveur", async () => {
  const f = faux({ rpc: { lire_invitation: INFO, finaliser_invitation: {} } });
  await traiter({ action: "accepter", jeton, pin: "123456", nom: "Inès" }, f.deps);
  const attendu = await motDePasse(POIVRE, "237690000009", "123456");
  const cree = f.appels.find(([n]) => n === "creerCompte")!;
  const session = f.appels.find(([n]) => n === "ouvrirSession")!;
  assertEquals(cree[2], attendu);
  assertEquals(session[2], attendu);
  assertNotEquals(attendu, "123456");
  assert(attendu.length >= 40);
  assertNotEquals(await motDePasse("autre-poivre", "237690000009", "123456"), attendu);
});

Deno.test("accepter avec un nouveau compte", async () => {
  const f = faux({ rpc: { lire_invitation: INFO, finaliser_invitation: { group_id: "g1" } } });
  assertEquals(await traiter({ action: "accepter", jeton, pin: "123456", nom: "Inès" }, f.deps), { session: SESSION });
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

Deno.test("compte Auth orphelin pour ce numéro : repris (nouveau mot de passe) au lieu de bloquer", async () => {
  const f = faux({ creerErreur: new ErreurMetier("Un compte existe déjà", 409),
    rpc: { lire_invitation: INFO, compte_auth_orphelin: "u-orphelin", finaliser_invitation: {} } });
  assertEquals(await traiter({ action: "accepter", jeton, pin: "123456" }, f.deps), { session: SESSION });
  assertEquals(f.noms(), ["lire_invitation", "creerCompte", "compte_auth_orphelin", "changerMotDePasse", "finaliser_invitation", "ouvrirSession"]);
  assertEquals(f.appels[3][1], "u-orphelin");
  assertEquals((f.appels[4][1] as { p_person: string }).p_person, "u-orphelin");
});

Deno.test("compte existant et rattaché ailleurs : pas de reprise, erreur claire", async () => {
  const f = faux({ creerErreur: new ErreurMetier("Un compte existe déjà", 409), rpc: { lire_invitation: INFO, compte_auth_orphelin: null } });
  await statut(traiter({ action: "accepter", jeton, pin: "123456" }, f.deps), 409, "Un compte existe déjà");
  assertEquals(f.noms().includes("changerMotDePasse"), false);
});

Deno.test("compte existant : le PIN est vérifié, aucun second compte", async () => {
  const f = faux({ rpc: { lire_invitation: { ...INFO, compte_existant: true, person_id: "u-existant" }, finaliser_invitation: {} } });
  await traiter({ action: "accepter", jeton, pin: "123456" }, f.deps);
  assertEquals(f.noms(), ["lire_invitation", "reserver_essai", "ouvrirSession", "enregistrer_succes", "finaliser_invitation"]);
  assertEquals((f.appels[4][1] as { p_person: string }).p_person, "u-existant");
});

Deno.test("compte existant, PIN faux : l'essai reste compté, rien n'est finalisé", async () => {
  const f = faux({ session: null, rpc: { lire_invitation: { ...INFO, compte_existant: true, person_id: "u-existant" } } });
  await statut(traiter({ action: "accepter", jeton, pin: "000000" }, f.deps), 401, "Numéro ou PIN incorrect");
  assertEquals(f.noms(), ["lire_invitation", "reserver_essai", "ouvrirSession"]);
});

Deno.test("PIN mal formé : refusé avant toute création", async () => {
  const f = faux({ rpc: { lire_invitation: INFO } });
  await statut(traiter({ action: "accepter", jeton, pin: "12" }, f.deps), 400, "Le PIN doit contenir 6 chiffres");
  assertEquals(f.noms(), ["lire_invitation"]);
});

Deno.test("nouveau PIN : le lien est consommé AVANT le changement de mot de passe", async () => {
  const f = faux({ rpc: { lire_invitation: { ...INFO, kind: "reinitialisation", compte_existant: true, person_id: "u-existant" },
    finaliser_nouveau_pin: { person_id: "u-existant", phone: "237690000009" } } });
  assertEquals(await traiter({ action: "nouveau_pin", jeton, pin: "654321" }, f.deps), { session: SESSION });
  assertEquals(f.noms(), ["lire_invitation", "finaliser_nouveau_pin", "changerMotDePasse", "ouvrirSession"]);
  assertEquals(f.appels[2][1], "u-existant");
  assertEquals(f.appels[2][2], await motDePasse(POIVRE, "237690000009", "654321"));
});

Deno.test("nouveau PIN : si le lien a déjà été consommé (envoi concurrent), le mot de passe ne change pas", async () => {
  const f = faux({ rpc: { lire_invitation: { ...INFO, kind: "reinitialisation", compte_existant: true, person_id: "u-existant" },
    finaliser_nouveau_pin: new ErreurMetier("Lien invalide ou expiré", 404) } });
  await statut(traiter({ action: "nouveau_pin", jeton, pin: "654321" }, f.deps), 404, "Lien invalide ou expiré");
  assertEquals(f.noms().includes("changerMotDePasse"), false);
});

Deno.test("un lien d'invitation ne sert pas à changer de PIN, et inversement", async () => {
  await statut(traiter({ action: "nouveau_pin", jeton, pin: "654321" }, faux({ rpc: { lire_invitation: INFO } }).deps),
    404, "Lien invalide ou expiré");
  await statut(traiter({ action: "accepter", jeton, pin: "654321" },
    faux({ rpc: { lire_invitation: { ...INFO, kind: "reinitialisation" } } }).deps), 404, "Lien invalide ou expiré");
});

Deno.test("connexion : numéro normalisé, essai réservé avant la vérification, succès enregistré", async () => {
  const f = faux();
  assertEquals(await traiter({ action: "connexion", telephone: "+237 6 90 00 00 02", pin: "123456" }, f.deps), { session: SESSION });
  assertEquals(f.appels, [["reserver_essai", { p_phone: "237690000002" }],
    ["ouvrirSession", "237690000002@njangi237.local", await motDePasse(POIVRE, "237690000002", "123456")],
    ["enregistrer_succes", { p_phone: "237690000002" }]]);
});

Deno.test("connexion bloquée : aucune vérification du PIN tant que le blocage dure", async () => {
  const f = faux({ rpc: { reserver_essai: { autorise: false, bloque_jusqu: "2026-10-16T12:00:00Z" } } });
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "123456" }, f.deps), 429, "Trop d'essais : réessayez après 13:00");
  assertEquals(f.noms(), ["reserver_essai"]);
});

Deno.test("cinquième PIN faux : le blocage est annoncé", async () => {
  const f = faux({ session: null, rpc: { reserver_essai: { autorise: true, bloque_jusqu: "2026-10-16T12:15:00Z" } } });
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "000000" }, f.deps), 429, "Trop d'essais : réessayez après 13:15");
});

Deno.test("essais simultanés : jamais plus de 5 vérifications du PIN", async () => {
  let essais = 0;
  const reserver = () => { essais++; return essais <= 5 ? { autorise: true, bloque_jusqu: essais === 5 ? "2026-10-16T12:15:00Z" : null }
    : { autorise: false, bloque_jusqu: "2026-10-16T12:15:00Z" }; };
  const f = faux({ session: null, rpc: { reserver_essai: reserver } });
  await Promise.allSettled(Array.from({ length: 10 }, () => traiter({ action: "connexion", telephone: "690000002", pin: "000000" }, f.deps)));
  assertEquals(f.noms().filter((n) => n === "ouvrirSession").length, 5);
});

Deno.test("panne d'Auth : erreur 503, l'essai est rendu", async () => {
  const f = faux({ session: new ErreurMetier("Service indisponible, réessayez", 503) });
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "123456" }, f.deps), 503, "Service indisponible");
  assertEquals(f.noms(), ["reserver_essai", "ouvrirSession", "annuler_essai"]);
});

Deno.test("connexion : numéro ou PIN mal formé, action inconnue", async () => {
  await statut(traiter({ action: "connexion", telephone: "12", pin: "123456" }, faux().deps), 400, "Numéro de téléphone invalide");
  await statut(traiter({ action: "connexion", telephone: "690000002", pin: "12" }, faux().deps), 401, "Numéro ou PIN incorrect");
  await statut(traiter({ action: "pirater" }, faux().deps), 400, "Action inconnue");
});

Deno.test("changer de PIN : session exigée, ancien PIN vérifié avec le blocage, nouveau mot de passe dérivé", async () => {
  await statut(traiter({ action: "changer_pin", ancien: "123456", nouveau: "654321" }, faux().deps), 401, "Session expirée");
  const f = faux({ utilisateur: { id: "u-moi", email: "237690000002@njangi237.local" } });
  assertEquals(await traiter({ action: "changer_pin", ancien: "123456", nouveau: "654321" }, f.deps, "jwt-moi"), { session: SESSION });
  assertEquals(f.noms(), ["utilisateur", "reserver_essai", "ouvrirSession", "enregistrer_succes", "changerMotDePasse", "ouvrirSession"]);
  assertEquals(f.appels[2][2], await motDePasse(POIVRE, "237690000002", "123456"));
  assertEquals(f.appels[4], ["changerMotDePasse", "u-moi", await motDePasse(POIVRE, "237690000002", "654321")]);
});

Deno.test("changer de PIN : ancien PIN faux → rien n'est changé", async () => {
  const f = faux({ session: null, utilisateur: { id: "u-moi", email: "237690000002@njangi237.local" } });
  await statut(traiter({ action: "changer_pin", ancien: "000000", nouveau: "654321" }, f.deps, "jwt-moi"), 401, "Numéro ou PIN incorrect");
  assertEquals(f.noms().includes("changerMotDePasse"), false);
});

Deno.test("amorçage : seulement pour le numéro prévu", async () => {
  const f = faux({ rpc: { amorcer_admin: { person_id: "u-nouveau" } } });
  await statut(traiter({ action: "amorcer", telephone: "690000002", nom: "X", pin: "123456" }, f.deps), 403, "Amorçage non autorisé");
  assertEquals(f.appels.length, 0);
  assertEquals(await traiter({ action: "amorcer", telephone: "6 76 77 46 43", nom: "Olivier", pin: "123456" }, f.deps), { session: SESSION });
  assertEquals(f.noms(), ["creerCompte", "amorcer_admin", "ouvrirSession"]);
  assertEquals(f.appels[1][1], { p_person: "u-nouveau", p_phone: "237676774643", p_full_name: "Olivier" });
});

Deno.test("amorçage déjà fait : le compte créé est supprimé", async () => {
  const f = faux({ rpc: { amorcer_admin: new ErreurMetier("Plateforme déjà initialisée", 403) } });
  await statut(traiter({ action: "amorcer", telephone: "676774643", nom: "Olivier", pin: "123456" }, f.deps), 403, "déjà initialisée");
  assertEquals(f.noms(), ["creerCompte", "amorcer_admin", "supprimerCompte"]);
});
