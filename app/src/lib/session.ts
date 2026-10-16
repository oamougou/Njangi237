import { estReseau } from "./erreurs";
import { memoriser, relire, type Stockage } from "./horsLigne";
import type { Api, Personne } from "./types";

const CLE = "moi";

/**
 * Personne connectée. En ligne, elle est gardée sur le téléphone ; sans réseau (application rouverte dans le bus),
 * on reprend la dernière connue au lieu de renvoyer vers l'écran de connexion. Une coupure n'est jamais une déconnexion.
 */
export async function chargerMoi(api: Api, s: Stockage): Promise<Personne | null> {
  try {
    const moi = await api.session();
    if (moi) memoriser(s, CLE, moi); else oublierMoi(s);
    return moi;
  } catch (e) {
    return estReseau(e) ? relire<Personne>(s, CLE)?.donnees ?? null : null;
  }
}

export function oublierMoi(s: Stockage) { s.supprimer(`njangi.vue.${CLE}`); }
