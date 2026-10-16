import type { Stockage } from "../lib/horsLigne";
import { dateCourte, fcfa } from "../lib/format";
import type { Api, MonGroupe } from "../lib/types";
import { useVue } from "../lib/useVue";

const TYPE: Record<string, string> = { tontine: "Tontine", cotisation: "Cotisation", association: "Association", autre: "Groupe" };

function Resume({ g }: { g: MonGroupe }) {
  const r = g.resume;
  if (!r || !r.cycle) return <p className="note">Aucun cycle en cours</p>;
  return (
    <>
      {r.monEtat === "paye" && <p className="ok">Payé ✓</p>}
      {r.monEtat === "en_attente" && <p className="note">En attente de validation</p>}
      {r.monEtat === "conteste" && <p className="alerte">Paiement contesté : à déclarer à nouveau</p>}
      {r.monEtat === "a_payer" && r.montant !== null && <p><b>À payer : {fcfa(r.montant)}{r.echeance ? ` avant le ${dateCourte(r.echeance)}` : ""}</b></p>}
      {g.role === "tresorier" && r.aValider > 0 && <p className="pastille declare">{r.aValider} paiement{r.aValider > 1 ? "s" : ""} à valider</p>}
    </>
  );
}

export function MesGroupes({ api, personId, stockage }: { api: Api; personId: string; stockage: Stockage }) {
  const { vue: groupes, horsLigne, err } = useVue<MonGroupe[]>({
    // Pas d'abonnement temps réel ici : la liste se recharge à chaque retour sur l'écran (et au retour du réseau)
    cle: `${personId}.groupes`, stockage, charger: () => api.mesGroupes(), abonner: () => () => {},
  });
  if (err && !groupes) return <p className="alerte">{err}</p>;
  if (!groupes) return <p className="note">Chargement…</p>;
  if (!groupes.length) return <div className="vide"><b>Aucun groupe pour l'instant</b><p>Votre trésorier vous enverra un lien d'invitation.</p></div>;
  return (
    <>
      {horsLigne && <p className="alerte">Hors ligne : dernières données connues</p>}
      <ul className="liste">
        {groupes.map((g) => (
          <li key={g.membership_id} className="carte groupe">
            <a className="groupe-lien" href={`#/groupe/${g.groupe.id}`}>
              <div className="ligne"><h3>{g.groupe.name}</h3>
                <span className={`pastille ${g.role}`}>{g.role === "tresorier" ? "Trésorier" : "Membre"}</span></div>
              <p className="note">{TYPE[g.groupe.type] ?? "Groupe"} · {g.groupe.frequency} · {fcfa(g.groupe.amount)} par cycle{g.resume?.cycle ? ` · ${g.resume.cycle}` : ""}</p>
              <Resume g={g} />
            </a>
          </li>))}
      </ul>
    </>
  );
}
