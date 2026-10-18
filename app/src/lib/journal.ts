import { finAffichee, LIBELLE_OFFRE, montantTexte } from "./abonnement";
import { de, fcfa } from "./format";
import type { Devise, EntreeJournal, Offre } from "./types";

const ROLE: Record<string, string> = { tresorier: "trésorier", membre: "membre" };

/** Une phrase lisible par entrée du journal ; une action inconnue (version future) reste affichable. */
export function libelleJournal(e: EntreeJournal): string {
  const s = (k: string) => String(e.details[k] ?? "");
  const n = (k: string) => Number(e.details[k] ?? 0);
  const ordre = Array.isArray(e.details.ordre) ? (e.details.ordre as unknown[]).map((x, i) => `${i + 1}. ${String(x)}`).join(", ") : "";
  switch (e.action) {
    case "groupe_cree": return `Groupe « ${s("nom")} » créé`;
    case "membre_ajoute": return `${s("nom")} ajouté au groupe`;
    case "membre_rejoint": return `${s("nom")} a rejoint le groupe`;
    case "membre_retire": return `${s("nom")} a quitté le groupe`;
    case "solde_depart": return `Solde de départ ${de(s("nom"))} : ${fcfa(n("montant_restant"))}`;
    case "role_change": return `${s("nom")} devient ${ROLE[s("role")] ?? s("role")}`;
    case "invitation_envoyee": return `Invitation envoyée à ${s("nom")}`;
    case "nouveau_pin_envoye": return `Lien de nouveau PIN envoyé à ${s("nom")}`;
    case "pin_reinitialise": return `${s("nom")} a choisi un nouveau PIN`;
    case "cycle_ouvert": return `Cycle « ${s("cycle")} » ouvert`;
    case "cycle_clos": return `Cycle « ${s("cycle")} » clos${n("dettes") ? ` · ${n("dettes")} dette${n("dettes") > 1 ? "s" : ""}` : ""}`;
    case "cycle_rouvert": return `Cycle « ${s("cycle")} » rouvert`;
    case "paiement_conteste": return `Paiement ${de(s("nom"))} contesté (${fcfa(n("montant"))}) : ${s("motif")}`;
    case "ordre_modifie": return `Ordre des tours modifié : ${ordre}`;
    case "tirage_au_sort": return `Tirage au sort de l'ordre : ${ordre}`;
    case "tours_echanges": return `Tours échangés entre ${s("a")} et ${s("b")}`;
    case "cagnotte_remise": return `Cagnotte remise à ${s("nom")} : ${fcfa(n("montant"))}`;
    case "nouveau_tour": return `Nouveau tour (tour ${n("tour")})`;
    case "abonnement_demande": return `Demande d'abonnement ${LIBELLE_OFFRE[s("offre") as Offre] ?? s("offre")} (${n("duree")} mois, ${montantTexte(n("montant"), s("devise") as Devise)})`;
    case "abonnement_accepte": return `Abonnement ${LIBELLE_OFFRE[s("offre") as Offre] ?? s("offre")} activé jusqu'au ${finAffichee(s("fin"))}`;
    case "abonnement_refuse": return `Demande d'abonnement refusée : ${s("motif")}`;
    case "abonnement_annule": return "Demande d'abonnement annulée";
    case "pilote_attribue": return `Offre Pilote jusqu'au ${finAffichee(s("fin"))}`;
    default: return e.action.replace(/_/g, " ");
  }
}
