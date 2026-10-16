import { useCallback, useEffect, useState } from "react";
import type { Api, VueGroupe } from "../../lib/types";
import { OngletCycle } from "./OngletCycle";
import { OngletMembres } from "./OngletMembres";

/** Espace d'un groupe. Le trésorier y gère cycles et membres ; l'espace membre arrive au lot 4. */
export function Groupe({ api, id, onglet }: { api: Api; id: string; onglet: "cycle" | "membres" }) {
  const [vue, setVue] = useState<VueGroupe | null>(null); const [err, setErr] = useState("");
  const recharger = useCallback(() => {
    api.chargerGroupe(id).then((v) => { setVue(v); setErr(""); }).catch((e) => setErr((e as Error).message));
  }, [api, id]);
  useEffect(() => { recharger(); }, [recharger]);

  // Un rechargement raté ne fait pas disparaître l'écran : on garde la dernière vue et on propose de réessayer
  const bandeau = err && (
    <div className="alerte ligne" role="alert"><span>{err}</span><button className="btn petit" onClick={recharger}>Réessayer</button></div>);

  if (!vue) return bandeau || <p className="note">Chargement…</p>;
  if (vue.role !== "tresorier") return (
    <section className="carte"><h2>{vue.groupe.name}</h2><p>Votre espace membre arrive bientôt : vous pourrez y déclarer vos paiements et suivre les tours.</p>
      <a className="btn" href="#/">Retour à mes groupes</a></section>);
  return (
    <section>
      <div className="ligne"><h2>{vue.groupe.name}</h2><a className="lien" href="#/">← Mes groupes</a></div>
      {bandeau}
      <nav className="onglets">
        <a href={`#/groupe/${id}`} className={onglet === "cycle" ? "actif" : ""}>Cycle</a>
        <a href={`#/groupe/${id}/membres`} className={onglet === "membres" ? "actif" : ""}>Membres</a>
      </nav>
      {onglet === "cycle" ? <OngletCycle api={api} vue={vue} recharger={recharger} /> : <OngletMembres api={api} vue={vue} recharger={recharger} />}
    </section>
  );
}
