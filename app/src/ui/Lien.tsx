import { useState } from "react";
import type { LienEnvoye } from "../lib/types";

/** Lien prêt à envoyer : bouton WhatsApp (message pré-rempli) et copie du lien. */
export function Lien({ envoi, titre }: { envoi: LienEnvoye; titre: string }) {
  const [copie, setCopie] = useState(false);
  const copier = async () => { await navigator.clipboard.writeText(envoi.lien); setCopie(true); setTimeout(() => setCopie(false), 2000); };
  return (
    <div className="carte succes">
      <h3>{titre}</h3>
      <p>Valable jusqu'au {new Date(envoi.expire).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}, une seule fois.</p>
      {envoi.demo
        ? <p className="note">Mode démo : lien fictif, rien n'est envoyé.</p>
        : <a className="btn principal" href={envoi.whatsapp} target="_blank" rel="noreferrer">Envoyer à {envoi.nom} sur WhatsApp</a>}
      <button className="btn" onClick={copier}>{copie ? "Lien copié" : "Copier le lien"}</button>
    </div>
  );
}
