import { useEffect, useState } from "react";
import type { Api, MonGroupe } from "../lib/types";

const TYPE: Record<string, string> = { tontine: "Tontine", cotisation: "Cotisation", association: "Association", autre: "Groupe" };
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export function MesGroupes({ api }: { api: Api }) {
  const [groupes, setGroupes] = useState<MonGroupe[] | null>(null); const [err, setErr] = useState("");
  useEffect(() => { api.mesGroupes().then(setGroupes).catch((e) => setErr((e as Error).message)); }, [api]);
  if (err) return <p className="alerte">{err}</p>;
  if (!groupes) return <p className="note">Chargement…</p>;
  if (!groupes.length) return <div className="vide"><b>Aucun groupe pour l'instant</b><p>Votre trésorier vous enverra un lien d'invitation.</p></div>;
  return (
    <ul className="liste">
      {groupes.map((g) => (
        <li key={g.membership_id} className="carte groupe">
          <a className="groupe-lien" href={`#/groupe/${g.groupe.id}`}>
            <div className="ligne"><h3>{g.groupe.name}</h3>
              <span className={`pastille ${g.role}`}>{g.role === "tresorier" ? "Trésorier" : "Membre"}</span></div>
            <p className="note">{TYPE[g.groupe.type] ?? "Groupe"} · {g.groupe.frequency} · {fcfa(g.groupe.amount)} par cycle</p>
          </a>
        </li>))}
    </ul>
  );
}
