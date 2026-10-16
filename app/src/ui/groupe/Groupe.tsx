import type { Stockage } from "../../lib/horsLigne";
import type { Api, VueGroupe } from "../../lib/types";
import { useVue } from "../../lib/useVue";
import { dateCourte } from "../../lib/format";
import { EspaceMembre } from "../membre/EspaceMembre";
import { OngletCycle } from "./OngletCycle";
import { OngletMembres } from "./OngletMembres";
import { Avatar } from "../Decor";

/** Espace d'un groupe : trésorier (onglets) ou membre. Mémoire locale, temps réel, lecture seule hors ligne. */
export function Groupe({ api, id, onglet, personId, stockage }: {
  api: Api; id: string; onglet: "cycle" | "membres"; personId: string; stockage: Stockage;
}) {
  const { vue, le, horsLigne, err, recharger } = useVue<VueGroupe>({
    cle: `${personId}.groupe.${id}`, stockage,
    charger: () => api.chargerGroupe(id), abonner: (cb) => api.abonner([id], cb),
  });

  const bandeau = (err || horsLigne) && (
    <div className="alerte ligne" role="alert">
      <span>{horsLigne ? `Hors ligne${le ? ` · données du ${dateCourte(le).slice(0, 5)}` : ""} : les actions reprendront au retour du réseau` : err}</span>
      <button className="btn petit" onClick={recharger}>Réessayer</button>
    </div>);

  if (!vue) return bandeau || <p className="note">Chargement…</p>;
  if (vue.role !== "tresorier") return <EspaceMembre api={api} groupId={id} personId={personId} stockage={stockage} />;
  return (
    <section>
      <div className="ligne"><div className="titre-groupe"><Avatar id={vue.groupe.id} nom={vue.groupe.name} /><h2>{vue.groupe.name}</h2></div><a className="lien" href="#/">← Mes groupes</a></div>
      {bandeau}
      <nav className="onglets">
        <a href={`#/groupe/${id}`} className={onglet === "cycle" ? "actif" : ""}>Cycle</a>
        <a href={`#/groupe/${id}/membres`} className={onglet === "membres" ? "actif" : ""}>Membres</a>
      </nav>
      {/* Un fieldset désactivé désactive d'un coup tous les boutons et champs : lecture seule hors ligne */}
      <fieldset className="sans-cadre" disabled={horsLigne}>
        {onglet === "cycle" ? <OngletCycle api={api} vue={vue} recharger={recharger} /> : <OngletMembres api={api} vue={vue} recharger={recharger} />}
      </fieldset>
    </section>
  );
}
