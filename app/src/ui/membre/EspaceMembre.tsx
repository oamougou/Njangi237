import { useMemo, useRef, useState } from "react";
import { estReseau } from "../../lib/erreurs";
import { monEtat } from "../../lib/etatMembre";
import { dateCourte, de, fcfa } from "../../lib/format";
import { lireFile, mettreEnFile, type Stockage } from "../../lib/horsLigne";
import { estimerTour } from "../../lib/tours";
import type { Api, Declaration, Dette, Paiement } from "../../lib/types";
import { useVue } from "../../lib/useVue";
import { FormDeclaration, type SaisieDeclaration } from "./FormDeclaration";

const ETAT_PAIEMENT: Record<Paiement["status"], string> = { declare: "En attente", valide: "Validé", conteste: "Contesté" };
const MOIS = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

type Formulaire = { cycleId: string; titre: string; montant: number; detteId: string | null } | null;

export function EspaceMembre({ api, groupId, personId, stockage }: { api: Api; groupId: string; personId: string; stockage: Stockage }) {
  const { vue, le, horsLigne, err, recharger } = useVue({
    cle: `${personId}.membre.${groupId}`, stockage,
    charger: () => api.chargerVueMembre(groupId), abonner: (cb) => api.abonner([groupId], cb),
  });
  const [form, setForm] = useState<Formulaire>(null);
  const [info, setInfo] = useState(""); const [erreur, setErreur] = useState(""); const [occupe, setOccupe] = useState(false);
  const [, rafraichir] = useState(0);
  const enCours = useRef(false);

  const file = lireFile(stockage).filter((e) => e.declaration.groupId === groupId);
  const ouvert = vue?.cycles.find((c) => c.status === "ouvert") ?? null;
  const etat = useMemo(() => (vue ? monEtat(ouvert, vue.moi, vue.paiements, file) : null), [vue, ouvert, file]);

  if (!vue) return err ? <p className="alerte">{err}</p> : <p className="note">Chargement…</p>;

  const declarer = async (s: SaisieDeclaration) => {
    if (!form || enCours.current) return;
    enCours.current = true; setOccupe(true); setErreur(""); setInfo("");
    const d: Declaration = { id: crypto.randomUUID(), groupId, cycleId: form.cycleId, montant: s.montant, moyen: s.moyen,
      reference: s.reference, date: s.date, detteId: form.detteId };
    try {
      await api.declarerPaiement(d);
      setForm(null); setInfo("Paiement déclaré : votre trésorier va le valider."); recharger();
    } catch (e) {
      if (estReseau(e)) {
        mettreEnFile(stockage, d); setForm(null); rafraichir((n) => n + 1);
        setInfo("Pas de réseau : votre déclaration est gardée sur le téléphone et sera envoyée automatiquement au retour du réseau.");
      } else setErreur((e as Error).message);
    } finally { enCours.current = false; setOccupe(false); }
  };

  const remiseDuCycle = ouvert ? vue.remises.filter((r) => r.cycle_id === ouvert.id) : [];
  const nomTour = (id: string) => vue.ordre.find((o) => o.membership_id === id)?.display_name ?? "?";
  const taux = ouvert ? vue.recouvrement.find((r) => r.cycle_id === ouvert.id) : undefined;
  const estimation = vue.groupe.type === "tontine"
    ? estimerTour(vue.ordre, vue.groupe.beneficiaries_per_cycle, vue.groupe.frequency, ouvert) : null;
  const dettes = vue.dettes.filter((d) => !d.settled_at);
  const libelle = (cycleId: string) => vue.cycles.find((c) => c.id === cycleId)?.label ?? "cycle";
  const reglementEnAttente = (d: Dette) => vue.paiements.some((p) => p.debt_id === d.id && p.status === "declare")
    || file.some((e) => e.etat === "attente" && e.declaration.detteId === d.id);
  const refusees = file.filter((e) => e.etat === "rejete");

  return (
    <section>
      <div className="ligne"><h2>{vue.groupe.name}</h2><a className="lien" href="#/">← Mes groupes</a></div>
      {horsLigne && <p className="alerte">Hors ligne{le ? ` · données du ${dateCourte(le).slice(0, 5)} à ${new Date(le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>}
      {erreur && <p className="alerte flottante" role="alert">{erreur}</p>}
      {info && <p className="ok">{info}</p>}
      {refusees.map((e) => <p key={e.declaration.id} className="alerte">Déclaration de {fcfa(e.declaration.montant)} refusée : {e.erreur}</p>)}

      <section className="carte" role="region" aria-label="Cycle en cours">
        {ouvert && etat ? <>
          <div className="ligne"><h3>{ouvert.label}</h3>{ouvert.due_date && <span className="note">avant le {dateCourte(ouvert.due_date)}</span>}</div>
          {etat.etat === "paye" && <p className="ok">Payé ✓</p>}
          {etat.etat === "en_attente" && <p>En attente de validation par le trésorier.</p>}
          {etat.etat === "a_envoyer" && <p>En attente d'envoi (pas de réseau) : partira automatiquement.</p>}
          {etat.etat === "conteste" && <p className="alerte">Paiement contesté{etat.motif ? ` : ${etat.motif}` : ""}. Vous pouvez le déclarer à nouveau.</p>}
          {etat.etat === "a_payer" && <p>À payer : {fcfa(ouvert.amount_expected - etat.valide)}</p>}
          {etat.etat === "hors" && <p className="note">Vous avez rejoint le groupe après l'ouverture de ce cycle : rien à payer pour ce cycle.</p>}
          {remiseDuCycle.length > 0 && <p className="note">Bénéficiaire : {remiseDuCycle.map((r) => nomTour(r.membership_id)).join(", ")}</p>}
          {taux && <p className="note">Le groupe a collecté {fcfa(taux.collecte)} sur {fcfa(taux.attendu)} ({taux.attendu ? Math.round(taux.collecte * 100 / taux.attendu) : 0} %).</p>}
          {(etat.etat === "a_payer" || etat.etat === "conteste") && !form &&
            <button className="btn principal" onClick={() => setForm({ cycleId: ouvert.id, titre: `Déclarer mon paiement · ${ouvert.label}`,
              montant: ouvert.amount_expected - etat.valide, detteId: null })}>Déclarer mon paiement</button>}
        </> : <p className="note">Aucun cycle en cours.</p>}
      </section>

      {form && <FormDeclaration titre={form.titre} montant={form.montant} montantFixe={!!form.detteId} occupe={occupe}
        onAnnuler={() => setForm(null)} onDeclarer={declarer} />}

      {dettes.length > 0 && (
        <section className="carte" role="region" aria-label="Mes dettes">
          <h3>Mes dettes</h3>
          <ul className="liste">{dettes.map((d) => (
            <li key={d.id} className="ligne">
              <span>{libelle(d.cycle_id)} · {fcfa(d.amount)}</span>
              {reglementEnAttente(d) ? <span className="note">Règlement en attente</span>
                : <button className="btn petit" aria-label={`Régler la dette ${de(libelle(d.cycle_id))}`}
                    onClick={() => setForm({ cycleId: d.cycle_id, titre: `Régler la dette ${de(libelle(d.cycle_id))}`, montant: d.amount, detteId: d.id })}>
                    Régler</button>}
            </li>))}</ul>
        </section>
      )}

      {vue.groupe.type === "tontine" && vue.ordre.length > 0 && (
        <section className="carte" role="region" aria-label="Ordre des tours">
          <h3>Ordre des tours</h3>
          {estimation && <p className="note">{estimation.cyclesAvant === 0 ? "Votre tour : ce cycle !"
            : `Votre tour : dans ${estimation.cyclesAvant} cycle${estimation.cyclesAvant > 1 ? "s" : ""}${estimation.date ? ` (≈ ${MOIS(estimation.date)})` : ""}`}</p>}
          <ol className="liste tours">{vue.ordre.map((o) => (
            <li key={o.membership_id} className={`ligne${o.is_me ? " moi" : ""}`}>
              <span><b>{o.display_name}</b></span>
              <span className="note">{o.servi ? "a reçu sa part" : o.prevu ? "bénéficiaire ce cycle" : ""}</span>
            </li>))}</ol>
        </section>
      )}

      <section className="carte" role="region" aria-label="Mes paiements">
        <h3>Mes paiements</h3>
        {vue.paiements.length === 0 ? <p className="note">Aucun paiement pour l'instant.</p> : (
          <ul className="liste">{[...vue.paiements].reverse().map((p) => (
            <li key={p.id} className="ligne">
              <span>{libelle(p.cycle_id)}{p.debt_id ? " (dette)" : ""} · {fcfa(p.amount)}</span>
              <span className="note">{ETAT_PAIEMENT[p.status]} · {dateCourte(p.paid_on)}</span>
            </li>))}</ul>)}
      </section>
    </section>
  );
}
