import { viderFile, type Stockage } from "./horsLigne";
import type { Api } from "./types";

/** Envoie les déclarations en file au démarrage et à chaque retour du réseau ; prévient les écrans (« njangi:file »). */
export function demarrerEnvoi(api: Api, stockage: Stockage, cible: Window = window): () => void {
  const vider = () => {
    viderFile(stockage, (d) => api.declarerPaiement(d))
      .then((r) => { if (r.envoyes || r.rejetes) cible.dispatchEvent(new Event("njangi:file")); })
      .catch(() => { /* rien à faire : on réessaiera au prochain retour du réseau */ });
  };
  vider();
  cible.addEventListener("online", vider);
  return () => cible.removeEventListener("online", vider);
}
