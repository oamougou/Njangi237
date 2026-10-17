import type { Stockage } from "../../lib/horsLigne";
import type { OngletGroupe } from "../../lib/routes";
import type { Api, VueGroupe } from "../../lib/types";
import { useVue } from "../../lib/useVue";
import { dateCourte } from "../../lib/format";
import { EspaceMembre } from "../membre/EspaceMembre";
import { OngletCycle } from "./OngletCycle";
import { OngletJournal } from "./OngletJournal";
import { OngletMembres } from "./OngletMembres";
import { OngletTours } from "./OngletTours";
import { Avatar } from "../Decor";

/** Vue gardée sur le téléphone par une version précédente : champs du lot 5 absents (ordre inconnu = verrouillé). */
const completer = (v: VueGroupe): VueGroupe => ({
  ...v, remises: v.remises ?? [], groupe: { ...v.groupe, order_locked: v.groupe.order_locked ?? true },
});

/** Espace d'un groupe : trésorier (onglets) ou membre. Mémoire locale, temps réel, lecture seule hors ligne. */
export function Groupe({ api, id, onglet, personId, stockage }: {
  api: Api; id: string; onglet: OngletGroupe; personId: string; stockage: Stockage;
}) {
  const { vue: brute, le, horsLigne, err, recharger } = useVue<VueGroupe>({
    cle: `${personId}.groupe.${id}`, stockage,
    charger: () => api.chargerGroupe(id), abonner: (cb) => api.abonner([id], cb),
  });

  const bandeau = (err || horsLigne) && (
    <div className="alerte ligne" role="alert">
      <span>{horsLigne ? `Hors ligne${le ? ` · données du ${dateCourte(le).slice(0, 5)}` : ""} : les actions reprendront au retour du réseau` : err}</span>
      <button className="btn petit" onClick={recharger}>Réessayer</button>
    </div>);

  const vue = brute && completer(brute);
  if (!vue) return bandeau || <p className="note">Chargement…</p>;
  if (vue.role !== "tresorier") return <EspaceMembre api={api} groupId={id} personId={personId} stockage={stockage} />;
  return (
    <section>
      <div className="ligne"><div className="titre-groupe"><Avatar id={vue.groupe.id} nom={vue.groupe.name} /><h2>{vue.groupe.name}</h2></div><a className="lien" href="#/">← Mes groupes</a></div>
      {bandeau}
      <nav className="onglets">
        <a href={`#/groupe/${id}`} className={onglet === "cycle" ? "actif" : ""}>Cycle</a>
        <a href={`#/groupe/${id}/membres`} className={onglet === "membres" ? "actif" : ""}>Membres</a>
        {vue.groupe.type === "tontine" && <a href={`#/groupe/${id}/tours`} className={onglet === "tours" ? "actif" : ""}>Tours</a>}
        <a href={`#/groupe/${id}/journal`} className={onglet === "journal" ? "actif" : ""}>Journal</a>
      </nav>
      {/* Un fieldset désactivé désactive d'un coup tous les boutons et champs : lecture seule hors ligne */}
      <fieldset className="sans-cadre" disabled={horsLigne}>
        {onglet === "membres" ? <OngletMembres api={api} vue={vue} recharger={recharger} />
          : onglet === "tours" && vue.groupe.type === "tontine" ? <OngletTours api={api} vue={vue} recharger={recharger} />
          : onglet === "journal" ? <OngletJournal key={`${vue.cycles.length}-${vue.remises.filter((r) => r.status === "remis").length}`}
            api={api} groupId={id} />
          : <OngletCycle api={api} vue={vue} recharger={recharger} />}
      </fieldset>
    </section>
  );
}
