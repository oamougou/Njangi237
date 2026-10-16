import { ErreurMetier } from "./http.ts";
import { hashJeton, jetonValide } from "./jeton.ts";
import { motDePasse } from "./secret.ts";
import { emailInterne, normaliserTelephone, pinValide } from "./telephone.ts";
import type { Deps, InfoInvitation, Session } from "./types.ts";

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" });
const tropDEssais = (iso: string) => new ErreurMetier(`Trop d'essais : réessayez après ${heure(iso)}`, 429);
const LIEN_INVALIDE = () => new ErreurMetier("Lien invalide ou expiré", 404);

const mdp = (deps: Deps, phone: string, pin: string) => motDePasse(deps.poivre, phone, pin);

/**
 * Vérifie un PIN : l'essai est réservé AVANT la vérification (5 au plus, puis 15 minutes de blocage),
 * une panne d'Auth rend l'essai, une réussite remet le compteur à zéro.
 */
async function ouvrirSessionProtegee(phone: string, pin: string, deps: Deps): Promise<Session> {
  const r: { autorise: boolean; bloque_jusqu: string | null } = await deps.rpc("reserver_essai", { p_phone: phone });
  if (!r?.autorise) throw tropDEssais(r?.bloque_jusqu ?? new Date().toISOString());
  let session: Session | null;
  try {
    session = await deps.ouvrirSession(emailInterne(phone), await mdp(deps, phone, pin));
  } catch (e) {
    await deps.rpc("annuler_essai", { p_phone: phone });
    throw e;
  }
  if (!session) {
    if (r.bloque_jusqu) throw tropDEssais(r.bloque_jusqu);
    throw new ErreurMetier("Numéro ou PIN incorrect", 401);
  }
  await deps.rpc("enregistrer_succes", { p_phone: phone });
  return session;
}

/** Crée le compte Auth du numéro ; un compte resté sans personne (création interrompue) est repris. */
async function creerOuReprendre(phone: string, motDePasseDerive: string, deps: Deps): Promise<string> {
  try {
    return await deps.creerCompte(emailInterne(phone), motDePasseDerive);
  } catch (e) {
    if (!(e instanceof ErreurMetier) || e.status !== 409) throw e;
    const orphelin: string | null = await deps.rpc("compte_auth_orphelin", { p_email: emailInterne(phone) });
    if (!orphelin) throw e;
    await deps.changerMotDePasse(orphelin, motDePasseDerive);
    return orphelin;
  }
}

async function sessionApres(phone: string, motDePasseDerive: string, deps: Deps, message: string): Promise<Session> {
  const session = await deps.ouvrirSession(emailInterne(phone), motDePasseDerive);
  if (!session) throw new ErreurMetier(message, 500);
  return session;
}

const lirePhone = (s: unknown) => {
  try { return normaliserTelephone(String(s ?? "")); } catch (e) { throw new ErreurMetier((e as Error).message, 400); }
};

// deno-lint-ignore no-explicit-any
export async function traiter(body: any, deps: Deps, jwt?: string): Promise<unknown> {
  const action = body?.action;

  if (action === "connexion") {
    const phone = lirePhone(body.telephone);
    if (!pinValide(body.pin)) throw new ErreurMetier("Numéro ou PIN incorrect", 401);
    return { session: await ouvrirSessionProtegee(phone, body.pin, deps) };
  }

  if (action === "changer_pin") {
    const moi = jwt ? await deps.utilisateur(jwt) : null;
    const phone = moi?.email.split("@")[0] ?? "";
    if (!moi || !/^237\d{9}$/.test(phone)) throw new ErreurMetier("Session expirée : reconnectez-vous", 401);
    if (!pinValide(body.ancien)) throw new ErreurMetier("Numéro ou PIN incorrect", 401);
    if (!pinValide(body.nouveau)) throw new ErreurMetier("Le PIN doit contenir 6 chiffres", 400);
    await ouvrirSessionProtegee(phone, body.ancien, deps);
    const nouveau = await mdp(deps, phone, body.nouveau);
    await deps.changerMotDePasse(moi.id, nouveau);
    return { session: await sessionApres(phone, nouveau, deps, "PIN changé : reconnectez-vous avec le nouveau PIN") };
  }

  if (action === "amorcer") {
    const phone = lirePhone(body.telephone);
    // Le secret peut avoir été saisi avec ou sans 237, avec des espaces : on le normalise comme tout numéro
    let autorise: string | null = null;
    try { autorise = deps.telephoneAmorce ? normaliserTelephone(deps.telephoneAmorce) : null; } catch { autorise = null; }
    if (!autorise || phone !== autorise) throw new ErreurMetier("Amorçage non autorisé", 403);
    if (!pinValide(body.pin)) throw new ErreurMetier("Le PIN doit contenir 6 chiffres", 400);
    const motDePasseDerive = await mdp(deps, phone, body.pin);
    const id = await creerOuReprendre(phone, motDePasseDerive, deps);
    try {
      await deps.rpc("amorcer_admin", { p_person: id, p_phone: phone, p_full_name: String(body.nom ?? "").trim() });
    } catch (e) {
      await deps.supprimerCompte(id);
      throw e;
    }
    return { session: await sessionApres(phone, motDePasseDerive, deps, "Compte créé : connectez-vous avec votre numéro et votre PIN") };
  }

  if (!["apercu", "accepter", "nouveau_pin"].includes(action)) throw new ErreurMetier("Action inconnue", 400);
  if (!jetonValide(body.jeton)) throw LIEN_INVALIDE();
  const hash = await hashJeton(body.jeton);
  const info: InfoInvitation = await deps.rpc("lire_invitation", { p_token_hash: hash });

  if (action === "apercu") {
    return { type: info.kind, groupe: info.groupe, invite_par: info.invite_par, nom: info.nom, compte_existant: info.compte_existant };
  }

  if (!pinValide(body.pin)) throw new ErreurMetier("Le PIN doit contenir 6 chiffres", 400);

  if (action === "accepter") {
    if (info.kind !== "invitation") throw LIEN_INVALIDE();
    if (info.compte_existant) {
      const session = await ouvrirSessionProtegee(info.phone, body.pin, deps);
      await deps.rpc("finaliser_invitation", { p_token_hash: hash, p_person: session.user_id, p_full_name: null });
      return { session };
    }
    const motDePasseDerive = await mdp(deps, info.phone, body.pin);
    const id = await creerOuReprendre(info.phone, motDePasseDerive, deps);
    try {
      await deps.rpc("finaliser_invitation", { p_token_hash: hash, p_person: id, p_full_name: body.nom ?? null });
    } catch (e) {
      await deps.supprimerCompte(id);   // sinon le numéro resterait pris par un compte sans groupe
      throw e;
    }
    return { session: await sessionApres(info.phone, motDePasseDerive, deps, "Compte créé : connectez-vous avec votre numéro et votre PIN") };
  }

  // nouveau_pin : le lien est consommé d'abord ; un second envoi simultané échoue sans toucher au mot de passe
  if (info.kind !== "reinitialisation" || !info.person_id) throw LIEN_INVALIDE();
  const r: { person_id: string; phone: string } = await deps.rpc("finaliser_nouveau_pin", { p_token_hash: hash });
  const motDePasseDerive = await mdp(deps, r.phone, body.pin);
  try {
    await deps.changerMotDePasse(r.person_id, motDePasseDerive);
  } catch {
    throw new ErreurMetier("Le PIN n'a pas pu être changé : demandez un nouveau lien à votre trésorier", 500);
  }
  return { session: await sessionApres(r.phone, motDePasseDerive, deps, "PIN changé : connectez-vous avec votre numéro et votre nouveau PIN") };
}
