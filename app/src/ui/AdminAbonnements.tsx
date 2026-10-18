import { useCallback, useEffect, useState } from "react";
import { finAffichee, LIBELLE_MOYEN, LIBELLE_OFFRE, montantTexte } from "../lib/abonnement";
import { dateCourte } from "../lib/format";
import type { Api, VueAdminAbonnements } from "../lib/types";
import { Champ } from "./Champ";

const basculer = (liste: string[], id: string, max: number) =>
  liste.includes(id) ? liste.filter((x) => x !== id) : liste.length < max ? [...liste, id] : liste;

/** Administration des abonnements : demandes, offres des groupes, Pilote, Association, prix de lancement, numéros de paiement. */
export function AdminAbonnements({ api }: { api: Api }) {
  const [v, setV] = useState<VueAdminAbonnements | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [autres, setAutres] = useState<Record<string, string[]>>({});
  const [pilote, setPilote] = useState({ groupId: "", fin: "2027-01-31" });
  const [asso, setAsso] = useState<{ groupes: string[]; duree: 1 | 12 }>({ groupes: [], duree: 12 });
  const [pay, setPay] = useState({ mtn: "", orange: "", beneficiaire: "" });

  const charger = useCallback(() => {
    api.adminAbonnements().then((x) => {
      setV(x); setErr("");
      setPay({ mtn: x.paiement.mtn ?? "", orange: x.paiement.orange ?? "", beneficiaire: x.paiement.beneficiaire ?? "" });
    }).catch((e) => setErr((e as Error).message));
  }, [api]);
  useEffect(() => { charger(); }, [charger]);

  const agir = async (f: () => Promise<unknown>) => {
    setBusy(true); setErr("");
    try { await f(); charger(); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  if (!v) return err ? <p className="alerte">{err}</p> : <p className="note">Chargement des abonnements…</p>;
  return (
    <section>
      <h2>Abonnements</h2>
      {err && <p className="alerte">{err}</p>}

      <div className="carte">
        <h3>Demandes à traiter</h3>
        {v.demandes.length === 0 && <p className="note">Aucune demande en attente.</p>}
        {v.demandes.map((d) => (
          <article key={d.id} className="demande" aria-label={`Demande de ${d.groupe}`}>
            <p><b>{d.groupe}</b> · {LIBELLE_OFFRE[d.offre]} · {d.duree_mois === 12 ? "12 mois" : "1 mois"} · {montantTexte(d.montant, d.devise)}</p>
            <p className="note">{LIBELLE_MOYEN[d.moyen]}{d.reference ? ` · référence ${d.reference}` : ""} · {d.demandeur ?? "?"}, le {dateCourte(d.created_at)}</p>
            {d.precisions && <p className="note">Précisions : {d.precisions}</p>}
            {d.offre === "association" && (
              <fieldset className="sans-cadre"><legend className="note">Autres groupes couverts (4 au plus)</legend>
                {v.groupes.filter((g) => g.group_id !== d.group_id).map((g) => (
                  <label key={g.group_id} className="case"><input type="checkbox" checked={(autres[d.id] ?? []).includes(g.group_id)}
                    onChange={() => setAutres({ ...autres, [d.id]: basculer(autres[d.id] ?? [], g.group_id, 4) })} /> {g.nom}</label>))}
              </fieldset>)}
            <button className="btn principal" disabled={busy} onClick={() => agir(() => api.accepterDemande(d.id, autres[d.id] ?? []))}>Accepter</button>
            <Champ label="Motif du refus" value={motifs[d.id] ?? ""} onChange={(e) => setMotifs({ ...motifs, [d.id]: e.target.value })} />
            <button className="btn" disabled={busy || !(motifs[d.id] ?? "").trim()}
              onClick={() => agir(() => api.refuserDemande(d.id, (motifs[d.id] ?? "").trim()))}>Refuser</button>
          </article>))}
      </div>

      <div className="carte">
        <h3>Groupes</h3>
        <p className="note">Prix de lancement : {v.lancements} / 50</p>
        <div className="defile"><table className="tableau-offres">
          <thead><tr><th>Groupe</th><th>Offre</th><th>Fin</th><th>Membres</th><th>Lancement</th></tr></thead>
          <tbody>{v.groupes.map((g) => (
            <tr key={g.group_id}>
              <td>{g.nom}</td><td>{LIBELLE_OFFRE[g.offre]}</td><td>{g.fin ? finAffichee(g.fin) : "—"}</td>
              <td>{g.membres} / {g.limite}</td>
              <td><input type="checkbox" aria-label={`Prix de lancement pour ${g.nom}`} checked={g.prix_lancement} disabled={busy}
                onChange={() => agir(() => api.changerPrixLancement(g.group_id, !g.prix_lancement))} /></td>
            </tr>))}</tbody>
        </table></div>
      </div>

      <form className="carte" onSubmit={(e) => { e.preventDefault(); agir(() => api.attribuerPilote(pilote.groupId, pilote.fin)); }}>
        <h3>Offre Pilote</h3>
        <label className="champ"><span>Groupe pour l'offre Pilote</span>
          <select value={pilote.groupId} onChange={(e) => setPilote({ ...pilote, groupId: e.target.value })}>
            <option value="">Choisir…</option>
            {v.groupes.map((g) => <option key={g.group_id} value={g.group_id}>{g.nom}</option>)}
          </select></label>
        <Champ label="Dernier jour inclus" type="date" value={pilote.fin} onChange={(e) => setPilote({ ...pilote, fin: e.target.value })} />
        <button className="btn principal" disabled={busy || !pilote.groupId || !pilote.fin}>Attribuer l'offre Pilote</button>
      </form>

      <form className="carte" onSubmit={(e) => { e.preventDefault(); agir(() => api.creerAssociation(asso.groupes, asso.duree)); }}>
        <h3>Offre Association</h3>
        <fieldset className="sans-cadre" aria-label="Groupes de l'offre Association">
          {v.groupes.map((g) => (
            <label key={g.group_id} className="case"><input type="checkbox" checked={asso.groupes.includes(g.group_id)}
              onChange={() => setAsso({ ...asso, groupes: basculer(asso.groupes, g.group_id, 5) })} /> {g.nom}</label>))}
        </fieldset>
        <label className="champ"><span>Durée</span>
          <select value={asso.duree} onChange={(e) => setAsso({ ...asso, duree: Number(e.target.value) as 1 | 12 })}>
            <option value={1}>1 mois</option><option value={12}>12 mois</option>
          </select></label>
        <button className="btn principal" disabled={busy || asso.groupes.length === 0}>Créer l'offre Association</button>
      </form>

      <form className="carte" onSubmit={(e) => { e.preventDefault(); agir(() => api.reglerPaiement(pay.mtn, pay.orange, pay.beneficiaire)); }}>
        <h3>Numéros de paiement</h3>
        <Champ label="Numéro MTN MoMo" value={pay.mtn} onChange={(e) => setPay({ ...pay, mtn: e.target.value })} inputMode="tel" />
        <Champ label="Numéro Orange Money" value={pay.orange} onChange={(e) => setPay({ ...pay, orange: e.target.value })} inputMode="tel" />
        <Champ label="Au nom de" value={pay.beneficiaire} onChange={(e) => setPay({ ...pay, beneficiaire: e.target.value })} />
        <button className="btn principal" disabled={busy}>Enregistrer les numéros</button>
      </form>
    </section>
  );
}
