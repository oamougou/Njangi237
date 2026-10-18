import { useCallback, useEffect, useState } from "react";
import { alerteAbonnement, finAffichee, LIBELLE_OFFRE, montantTexte, prix, TARIFS } from "../../lib/abonnement";
import { dateCourte } from "../../lib/format";
import type { Api, EtatAbonnement, MoyenPaiement, OffrePayante } from "../../lib/types";
import { Champ } from "../Champ";
import { Barre } from "../Decor";

/** Offre du groupe, limites, tarifs, numéros de paiement et demande d'activation (trésorier). */
export function OngletAbonnement({ api, groupId, onChange }: { api: Api; groupId: string; onChange?: () => void }) {
  const [etat, setEtat] = useState<EtatAbonnement | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [offre, setOffre] = useState<OffrePayante>("groupe"); const [duree, setDuree] = useState<1 | 12>(1);
  const [moyen, setMoyen] = useState<MoyenPaiement>("mtn_momo");
  const [reference, setReference] = useState(""); const [precisions, setPrecisions] = useState("");

  const charger = useCallback(() => {
    api.etatAbonnement(groupId).then((e) => { setEtat(e); setErr(""); }).catch((x) => setErr((x as Error).message));
  }, [api, groupId]);
  useEffect(() => { charger(); }, [charger]);

  const agir = async (f: () => Promise<unknown>) => {
    setBusy(true); setErr("");
    try { await f(); charger(); onChange?.(); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  if (!etat) return err ? <p className="alerte">{err}</p> : <p className="note">Chargement…</p>;
  const alerte = alerteAbonnement(etat);
  const aPayer = prix(offre, duree, etat.prix_lancement);
  const mobile = moyen === "mtn_momo" || moyen === "orange_money";
  const enAttente = etat.demande?.statut === "en_attente" ? etat.demande : null;

  return (
    <section>
      <div className="carte">
        <h3>Offre {LIBELLE_OFFRE[etat.offre]}</h3>
        {etat.fin && <p>Jusqu'au {finAffichee(etat.fin)} inclus</p>}
        {etat.offre === "decouverte" && <p>Gratuite, sans limite de durée.</p>}
        <p className="note">{etat.membres} membre{etat.membres > 1 ? "s" : ""} sur {etat.limite}</p>
        <Barre valeur={(100 * etat.membres) / etat.limite} libelle="Membres par rapport à la limite de l'offre" />
        {alerte && <p className={alerte.niveau === "bloque" ? "alerte" : "note"} role="status">{alerte.texte}</p>}
      </div>

      {etat.demo ? <p className="note">Mode démo : le groupe est en offre Groupe, rien à payer.</p> : <>
        <div className="carte">
          <h3>Les offres</h3>
          {etat.prix_lancement && <p className="pastille declare">Prix de lancement : moitié prix à vie</p>}
          <table className="tableau-offres">
            <thead><tr><th>Offre</th><th>Par mois</th><th>Par an</th></tr></thead>
            <tbody>{TARIFS.map((t) => {
              const m = prix(t.offre, 1, etat.prix_lancement), a = prix(t.offre, 12, etat.prix_lancement);
              return <tr key={t.offre}><td><b>{t.nom}</b><br /><span className="note">{t.pourQui}</span></td>
                <td>{montantTexte(m.montant, m.devise)}</td><td>{montantTexte(a.montant, a.devise)}</td></tr>;
            })}</tbody>
          </table>
          <p className="note">Découverte reste gratuite jusqu'à 10 membres. Les membres ne paient jamais.</p>
        </div>

        <div className="carte">
          <h3>Payer</h3>
          {etat.paiement.mtn || etat.paiement.orange ? <>
            {etat.paiement.mtn && <p>MTN MoMo : <b>{etat.paiement.mtn}</b></p>}
            {etat.paiement.orange && <p>Orange Money : <b>{etat.paiement.orange}</b></p>}
            {etat.paiement.beneficiaire && <p className="note">Au nom de {etat.paiement.beneficiaire}</p>}
          </> : <p className="note">Les numéros de paiement ne sont pas encore communiqués : contactez l'administrateur.</p>}
        </div>

        {enAttente ? (
          <div className="carte">
            <h3>Demande en attente</h3>
            <p>Offre {LIBELLE_OFFRE[enAttente.offre]}, {enAttente.duree_mois === 12 ? "12 mois" : "1 mois"}, {montantTexte(enAttente.montant, enAttente.devise)}
              {enAttente.reference ? ` · référence ${enAttente.reference}` : ""}</p>
            <p className="note">L'administrateur vérifie votre paiement puis active l'offre.</p>
            <button className="btn" disabled={busy} onClick={() => agir(() => api.annulerDemande(enAttente.id))}>Annuler la demande</button>
          </div>
        ) : (
          <form className="carte" onSubmit={(e) => {
            e.preventDefault();
            agir(async () => {
              await api.demanderAbonnement({ groupId, offre, dureeMois: duree, moyen, reference: reference.trim() || null, precisions: precisions.trim() || null });
              setReference(""); setPrecisions("");
            });
          }}>
            <h3>J'ai payé</h3>
            {etat.demande?.statut === "refusee" && <p className="alerte">Demande précédente refusée : {etat.demande.motif}</p>}
            <label className="champ"><span>Offre</span>
              <select value={offre} onChange={(e) => setOffre(e.target.value as OffrePayante)}>
                {TARIFS.map((t) => <option key={t.offre} value={t.offre}>{t.nom}</option>)}
              </select></label>
            <label className="champ"><span>Durée</span>
              <select value={duree} onChange={(e) => setDuree(Number(e.target.value) as 1 | 12)}>
                <option value={1}>1 mois</option><option value={12}>12 mois</option>
              </select></label>
            <p>Montant à payer : <b>{montantTexte(aPayer.montant, aPayer.devise)}</b></p>
            <label className="champ"><span>Moyen</span>
              <select value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenPaiement)}>
                <option value="mtn_momo">MTN MoMo</option><option value="orange_money">Orange Money</option><option value="autre">Autre</option>
              </select></label>
            <Champ label="Référence de la transaction" value={reference} onChange={(e) => setReference(e.target.value)} required={mobile} />
            {offre === "association" && <Champ label="Autres groupes à couvrir" value={precisions} onChange={(e) => setPrecisions(e.target.value)} />}
            <button className="btn principal" disabled={busy || (mobile && !reference.trim())}>Envoyer la demande</button>
          </form>
        )}

        {etat.historique.length > 0 && (
          <div className="carte">
            <h3>Historique</h3>
            <ul>{etat.historique.map((h, i) => <li key={i}>{LIBELLE_OFFRE[h.offre]} : du {dateCourte(h.debut)} au {finAffichee(h.fin)}</li>)}</ul>
          </div>
        )}
      </>}
      {err && <p className="alerte">{err}</p>}
    </section>
  );
}
