import { lireFile, viderFile, type Stockage } from "./horsLigne";
import type { Api } from "./types";

const RELANCE_MS = 30_000;

/**
 * Envoie les déclarations en file de la personne connectée : au démarrage, au retour du réseau, quand l'application
 * revient au premier plan, et toutes les 30 s tant qu'il en reste (réseau faible sans événement « online »).
 * Prévient les écrans (« njangi:file ») après chaque envoi.
 */
export function demarrerEnvoi(api: Api, stockage: Stockage, personId: string, cible: Window = window): () => void {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  let actif = true;
  const programmer = () => {
    clearTimeout(minuterie);
    if (actif && lireFile(stockage, personId).some((e) => e.etat === "attente")) minuterie = setTimeout(vider, RELANCE_MS);
  };
  function vider() {
    clearTimeout(minuterie);
    viderFile(stockage, personId, (d) => api.declarerPaiement(d))
      .then((r) => { if (r.envoyes || r.rejetes) cible.dispatchEvent(new Event("njangi:file")); })
      .catch(() => { /* on réessaiera */ })
      .finally(programmer);
  }
  const auPremierPlan = () => { if (cible.document.visibilityState === "visible") vider(); };
  vider();
  cible.addEventListener("online", vider);
  cible.document.addEventListener("visibilitychange", auPremierPlan);
  return () => {
    actif = false; clearTimeout(minuterie);
    cible.removeEventListener("online", vider);
    cible.document.removeEventListener("visibilitychange", auPremierPlan);
  };
}
