import { ErreurMetier } from "./http.ts";
import { hashJeton, jetonValide } from "./jeton.ts";
import { emailInterne, normaliserTelephone, pinValide } from "./telephone.ts";
import type { Deps, InfoInvitation, Session } from "./types.ts";

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" });

/** Connexion protégée : refusée pendant un blocage, chaque PIN faux est compté (5 → 15 minutes). */
async function ouvrirSessionProtegee(phone: string, pin: string, deps: Deps): Promise<Session> {
  const bloque: string | null = await deps.rpc("verifier_blocage", { p_phone: phone });
  if (bloque) throw new ErreurMetier(`Trop d'essais : réessayez après ${heure(bloque)}`, 429);
  const session = await deps.ouvrirSession(emailInterne(phone), pin);
  if (!session) {
    const r: { bloque_jusqu: string | null } = await deps.rpc("enregistrer_echec", { p_phone: phone });
    if (r?.bloque_jusqu) throw new ErreurMetier(`Trop d'essais : réessayez après ${heure(r.bloque_jusqu)}`, 429);
    throw new ErreurMetier("Numéro ou PIN incorrect", 401);
  }
  await deps.rpc("enregistrer_succes", { p_phone: phone });
  return session;
}

const LIEN_INVALIDE = () => new ErreurMetier("Lien invalide ou expiré", 404);

// deno-lint-ignore no-explicit-any
export async function traiter(body: any, deps: Deps): Promise<unknown> {
  const action = body?.action;

  if (action === "connexion") {
    let phone: string;
    try { phone = normaliserTelephone(String(body.telephone ?? "")); }
    catch (e) { throw new ErreurMetier((e as Error).message, 400); }
    if (!pinValide(body.pin)) throw new ErreurMetier("Numéro ou PIN incorrect", 401);
    return { session: await ouvrirSessionProtegee(phone, body.pin, deps) };
  }

  if (!["apercu", "accepter", "nouveau_pin"].includes(action)) throw new ErreurMetier("Action inconnue", 400);
  if (!jetonValide(body.jeton)) throw LIEN_INVALIDE();
  const hash = await hashJeton(body.jeton);
  const info: InfoInvitation = await deps.rpc("lire_invitation", { p_token_hash: hash });

  if (action === "apercu") {
    return { type: info.kind, groupe: info.groupe, invite_par: info.invite_par, nom: info.nom, compte_existant: info.compte_existant };
  }

  if (!pinValide(body.pin)) throw new ErreurMetier("Le PIN doit contenir 6 chiffres", 400);
  const email = emailInterne(info.phone);

  if (action === "accepter") {
    if (info.kind !== "invitation") throw LIEN_INVALIDE();
    if (info.compte_existant) {
      const session = await ouvrirSessionProtegee(info.phone, body.pin, deps);
      await deps.rpc("finaliser_invitation", { p_token_hash: hash, p_person: session.user_id, p_full_name: null });
      return { session };
    }
    const id = await deps.creerCompte(email, body.pin);
    try {
      await deps.rpc("finaliser_invitation", { p_token_hash: hash, p_person: id, p_full_name: body.nom ?? null });
    } catch (e) {
      await deps.supprimerCompte(id);   // sinon le numéro resterait pris par un compte sans groupe
      throw e;
    }
    const session = await deps.ouvrirSession(email, body.pin);
    if (!session) throw new ErreurMetier("Compte créé : connectez-vous avec votre numéro et votre PIN", 500);
    return { session };
  }

  // nouveau_pin
  if (info.kind !== "reinitialisation" || !info.person_id) throw LIEN_INVALIDE();
  await deps.changerPin(info.person_id, body.pin);
  await deps.rpc("finaliser_nouveau_pin", { p_token_hash: hash });
  const session = await deps.ouvrirSession(email, body.pin);
  if (!session) throw new ErreurMetier("PIN changé : connectez-vous avec votre numéro et votre nouveau PIN", 500);
  return { session };
}
