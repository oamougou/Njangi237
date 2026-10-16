import { lireFile, type Stockage } from "../lib/horsLigne";
import { dateCourte, fcfa } from "../lib/format";
import type { Api, MonGroupe } from "../lib/types";
import { useVue } from "../lib/useVue";
import { Avatar, prenom } from "./Decor";

const TYPE: Record<string, string> = { tontine: "Tontine", cotisation: "Cotisation", association: "Association", autre: "Groupe" };

function Resume({ g, enFile }: { g: MonGroupe; enFile: boolean }) {
  const r = g.resume;
  if (!r || !r.cycle) return <p className="note">Aucun cycle en cours</p>;
  if (enFile && (r.monEtat === "a_payer" || r.monEtat === "conteste")) return <p className="etat attente">En attente d'envoi</p>;
  return (
    <>
      {r.monEtat === "hors" && <p className="etat neutre">Pas concerné par ce cycle</p>}
      {r.monEtat === "paye" && <p className="etat paye">Payé ✓</p>}
      {r.monEtat === "en_attente" && <p className="etat attente">En attente de validation</p>}
      {r.monEtat === "conteste" && <p className="etat conteste">Paiement contesté : à déclarer à nouveau</p>}
      {r.monEtat === "a_payer" && r.montant !== null && <p className="etat a-payer"><b>À payer : {fcfa(r.montant)}{r.echeance ? ` avant le ${dateCourte(r.echeance)}` : ""}</b></p>}
      {g.role === "tresorier" && r.aValider > 0 && <p className="pastille declare">{r.aValider} paiement{r.aValider > 1 ? "s" : ""} à valider</p>}
    </>
  );
}

export function MesGroupes({ api, personId, stockage, nom = "" }: { api: Api; personId: string; stockage: Stockage; nom?: string }) {
  const { vue: groupes, horsLigne, err } = useVue<MonGroupe[]>({
    // Pas d'abonnement temps réel ici : la liste se recharge à chaque retour sur l'écran (et au retour du réseau)
    cle: `${personId}.groupes`, stockage, charger: () => api.mesGroupes(), abonner: () => () => {},
  });
  if (err && !groupes) return <p className="alerte">{err}</p>;
  if (!groupes) return <p className={horsLigne ? "alerte" : "note"}>{horsLigne ? "Hors ligne : aucune donnée enregistrée sur ce téléphone. Réessayez avec du réseau." : "Chargement…"}</p>;
  const file = lireFile(stockage, personId).filter((e) => e.etat === "attente" && !e.declaration.detteId);
  const salut = prenom(nom) && <h2 className="salut">Bonjour {prenom(nom)} 👋</h2>;
  if (!groupes.length) return <>{salut}<div className="vide"><span className="vide-icone" aria-hidden="true">🌞</span>
    <b>Aucun groupe pour l'instant</b><p>Votre trésorier vous enverra un lien d'invitation.</p></div></>;
  return (
    <>
      {salut}
      {horsLigne && <p className="alerte">Hors ligne : dernières données connues</p>}
      <ul className="liste">
        {groupes.map((g) => (
          <li key={g.membership_id} className="carte groupe">
            <a className="groupe-lien" href={`#/groupe/${g.groupe.id}`}>
              <div className="ligne"><div className="titre-groupe"><Avatar id={g.groupe.id} nom={g.groupe.name} /><h3>{g.groupe.name}</h3></div>
                <span className={`pastille ${g.role}`}>{g.role === "tresorier" ? "Trésorier" : "Membre"}</span></div>
              <p className="note">{TYPE[g.groupe.type] ?? "Groupe"} · {g.groupe.frequency} · {fcfa(g.groupe.amount)} par cycle{g.resume?.cycle ? ` · ${g.resume.cycle}` : ""}</p>
              <Resume g={g} enFile={file.some((e) => e.declaration.groupId === g.groupe.id && e.declaration.cycleId === g.resume?.cycleId)} />
            </a>
          </li>))}
      </ul>
    </>
  );
}
