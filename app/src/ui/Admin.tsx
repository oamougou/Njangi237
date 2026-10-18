import { useState } from "react";
import type { Api, LienEnvoye, NouveauGroupe } from "../lib/types";
import { Champ } from "./Champ";
import { AdminAbonnements } from "./AdminAbonnements";
import { Lien } from "./Lien";

const VIDE: NouveauGroupe = { nom: "", type: "tontine", montant: 0, frequence: "mensuelle", beneficiaires: 1, tresorier_nom: "", tresorier_telephone: "" };

/** Administration de la plateforme (pilote) : création d'un groupe et invitation de son premier trésorier. */
export function Admin({ api }: { api: Api }) {
  const [g, setG] = useState<NouveauGroupe>(VIDE); const [envoi, setEnvoi] = useState<LienEnvoye | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const maj = <K extends keyof NouveauGroupe>(k: K, v: NouveauGroupe[K]) => setG({ ...g, [k]: v });
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { setEnvoi(await api.creerGroupe({ ...g, nom: g.nom.trim(), tresorier_nom: g.tresorier_nom.trim() })); setG(VIDE); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section>
      {envoi && <Lien envoi={envoi} titre="Groupe créé : invitez son trésorier" />}
      <form onSubmit={envoyer} className="carte">
        <h2>Nouveau groupe</h2>
        <Champ label="Nom du groupe" value={g.nom} onChange={(e) => maj("nom", e.target.value)} placeholder="Ex. Tontine Carrefour Magne" required />
        <label className="champ"><span>Type</span>
          <select value={g.type} onChange={(e) => maj("type", e.target.value as NouveauGroupe["type"])}>
            <option value="tontine">Tontine</option><option value="cotisation">Cotisation de quartier</option>
            <option value="association">Association</option><option value="autre">Autre</option>
          </select></label>
        <Champ label="Montant par membre et par cycle (FCFA)" value={g.montant || ""} inputMode="numeric" required
          onChange={(e) => maj("montant", parseInt(e.target.value.replace(/\D/g, "") || "0", 10))} />
        <label className="champ"><span>Fréquence</span>
          <select value={g.frequence} onChange={(e) => maj("frequence", e.target.value as NouveauGroupe["frequence"])}>
            <option value="hebdomadaire">Hebdomadaire</option><option value="mensuelle">Mensuelle</option><option value="ponctuelle">Ponctuelle</option>
          </select></label>
        {g.type === "tontine" && <Champ label="Bénéficiaires par cycle" value={g.beneficiaires} inputMode="numeric"
          onChange={(e) => maj("beneficiaires", Math.max(1, parseInt(e.target.value.replace(/\D/g, "") || "1", 10)))} />}
        <Champ label="Nom du trésorier" value={g.tresorier_nom} onChange={(e) => maj("tresorier_nom", e.target.value)} required />
        <Champ label="Numéro du trésorier" value={g.tresorier_telephone} onChange={(e) => maj("tresorier_telephone", e.target.value)}
          inputMode="tel" placeholder="6XX XX XX XX" required />
        {err && <p className="alerte">{err}</p>}
        <button className="btn principal" disabled={busy || !g.nom.trim() || g.montant <= 0}>Créer le groupe</button>
      </form>
      <AdminAbonnements api={api} />
    </section>
  );
}
