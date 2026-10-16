import { useMemo, useRef, useState } from "react";
import { csvCycle } from "../../lib/csv";
import { bilanCycle, LIBELLE_ETAT, type LigneCycle } from "../../lib/cycle";
import { dateCourte, de, fcfa } from "../../lib/format";
import { libelleParDefaut } from "../../lib/libelles";
import { lienWhatsApp } from "../../lib/liens";
import { messageRelance, prochaineRelance } from "../../lib/relances";
import type { Api, Dette, Paiement, VueGroupe } from "../../lib/types";
import { Confirmer } from "../Confirmer";
import { Champ } from "../Champ";

/** L'identifiant est tiré à l'ouverture du formulaire : un nouvel essai après une coupure réseau ne crée pas de doublon. */
type Saisie = { id: string; membreId: string; nom: string; cycleId: string; montant: string } | null;
type Encaissement = { id: string; dette: Dette; nom: string; libelle: string } | null;

const MOYEN: Record<Paiement["method"], string> = { mtn_momo: "MTN MoMo", orange_money: "Orange Money", especes: "Espèces", autre: "Autre" };

export function OngletCycle({ api, vue, recharger }: { api: Api; vue: VueGroupe; recharger: () => void }) {
  const { groupe, membres, cycles, paiements, dettes } = vue;
  const ouvert = cycles.find((c) => c.status === "ouvert") ?? null;
  const bilan = useMemo(() => (ouvert ? bilanCycle(ouvert, membres, paiements) : null), [ouvert, membres, paiements]);
  const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [occupe, setOccupe] = useState(false);
  const [contestation, setContestation] = useState<{ id: string; nom: string; motif: string } | null>(null);
  const [saisie, setSaisie] = useState<Saisie>(null);
  const [encaissement, setEncaissement] = useState<Encaissement>(null);
  const [cloture, setCloture] = useState(false);
  const [file, setFile] = useState<string[] | null>(null);

  // Référence (et non état) : un double clic arrive avant que React ait redessiné le bouton désactivé
  const enCours = useRef(false);
  const agir = async (f: () => Promise<unknown>, ok = "") => {
    if (enCours.current) return;
    enCours.current = true; setOccupe(true); setErr(""); setInfo("");
    try { await f(); if (ok) setInfo(ok); recharger(); }
    catch (x) { setErr((x as Error).message); recharger(); }   // l'écran reflète ce qui a pu passer malgré l'erreur
    finally { enCours.current = false; setOccupe(false); }
  };

  const nomDe = (id: string) => membres.find((m) => m.id === id)?.display_name ?? "?";

  const relancer = () => {
    if (!bilan || !ouvert) return;
    const enRetard = bilan.enRetard.map((l) => l.membre.id);
    const r = prochaineRelance(file, enRetard);
    if (!r.suivant) { setInfo("Personne n'est en retard."); setFile(null); return; }
    const m = membres.find((x) => x.id === r.suivant)!;
    window.open(lienWhatsApp(m.phone, messageRelance(m.display_name, groupe.name, ouvert.amount_expected, ouvert.due_date)), "_blank");
    setFile(r.file.length ? r.file : null);
  };

  const exporter = () => {
    if (!bilan || !ouvert) return;
    const url = URL.createObjectURL(new Blob([csvCycle(groupe.name, ouvert, bilan)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${groupe.name} - ${ouvert.label}.csv`.replace(/[\\/:*?"<>|]/g, "_");
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const enregistrerEspeces = (s: NonNullable<Saisie>) => {
    const montant = parseInt(s.montant || "0", 10);
    agir(async () => { await api.saisirEspeces(s.id, s.membreId, s.cycleId, montant); setSaisie(null); },
      `Espèces ${de(s.nom)} enregistrées (${fcfa(montant)}).`);
  };

  const dettesOuvertes = dettes.filter((d) => !d.settled_at);
  const dernierClos = !ouvert ? [...cycles].reverse().find((c) => c.status === "clos") ?? null : null;
  const nbRetard = bilan?.enRetard.length ?? 0;

  return (
    <section>
      {err && <p className="alerte flottante" role="alert">{err}</p>}
      {info && <p className="ok">{info}</p>}

      {ouvert && bilan ? (
        <>
          <div className="carte">
            <div className="ligne"><h2>{ouvert.label}</h2>{ouvert.due_date && <span className="note">avant le {dateCourte(ouvert.due_date)}</span>}</div>
            <div className="chiffres">
              <div><b>{fcfa(bilan.collecte)}</b><span>collecté</span></div>
              <div><b>{bilan.taux} %</b><span>sur {fcfa(bilan.attendu)}</span></div>
              <div><b>{nbRetard}</b><span>en retard</span></div>
            </div>
          </div>

          <ul className="liste">
            {bilan.lignes.map((l) => <LigneMembre key={l.membre.id} l={l} occupe={occupe}
              onValider={() => agir(() => api.validerPaiement(l.enAttente!.id), `Paiement ${de(l.membre.display_name)} validé.`)}
              onContester={(id) => setContestation({ id, nom: l.membre.display_name, motif: "" })}
              onEspeces={() => setSaisie({ id: crypto.randomUUID(), membreId: l.membre.id, nom: l.membre.display_name, cycleId: ouvert.id,
                montant: String(ouvert.amount_expected) })} />)}
          </ul>

          {saisie && <FormEspeces saisie={saisie} occupe={occupe} onChange={setSaisie} onAnnuler={() => setSaisie(null)} onEnregistrer={enregistrerEspeces} />}

          <div className="actions">
            <button className="btn" onClick={relancer}>
              {file && file.length ? `Relancer le suivant (${file.length} restant${file.length > 1 ? "s" : ""})` : "Relancer les retardataires"}
            </button>
            <button className="btn" onClick={exporter}>Exporter (CSV)</button>
            <button className="btn" onClick={recharger}>Actualiser</button>
          </div>

          {bilan.aValider > 0 && <p className="note">{bilan.aValider} paiement{bilan.aValider > 1 ? "s" : ""} à valider avant de clore le cycle.</p>}
          {cloture
            ? <Confirmer titre="Clore le cycle" libelle="Oui, clore" occupe={occupe}
                message={(nbRetard
                  ? `${nbRetard} membre${nbRetard > 1 ? "s deviendront débiteurs" : " deviendra débiteur"} du reste de sa cotisation.`
                  : "Tout le monde a payé.") + " Le cycle ne pourra plus recevoir de paiement ordinaire."}
                onNon={() => setCloture(false)}
                onOui={() => agir(async () => {
                  const r = await api.cloreCycle(ouvert.id); setCloture(false);
                  setInfo(r.dettes ? `Cycle clos : ${r.dettes} dette(s) pour ${fcfa(r.montant)}.` : "Cycle clos : tout le monde a payé.");
                })} />
            : <button className="btn" disabled={bilan.aValider > 0 || occupe} onClick={() => setCloture(true)}>Clore le cycle</button>}
        </>
      ) : (
        <NouveauCycle groupeId={groupe.id} frequence={groupe.frequency} occupe={occupe}
          onOuvrir={(libelle, echeance) => agir(() => api.ouvrirCycle(groupe.id, libelle, echeance), `Cycle « ${libelle} » ouvert.`)} />
      )}

      {dernierClos && (
        <p className="note">Dernier cycle : {dernierClos.label} (clos).{" "}
          <button className="lien" disabled={occupe} onClick={() => agir(() => api.rouvrirCycle(dernierClos.id), `Cycle « ${dernierClos.label} » rouvert.`)}>
            Rouvrir</button></p>
      )}

      {dettesOuvertes.length > 0 && (
        <section role="region" aria-label="Dettes à encaisser" className="carte">
          <h3>Dettes à encaisser</h3>
          <ul className="liste">
            {dettesOuvertes.map((d) => {
              const libelle = cycles.find((c) => c.id === d.cycle_id)?.label ?? "cycle"; const nom = nomDe(d.membership_id);
              const declare = paiements.find((p) => p.debt_id === d.id && p.status === "declare");
              return (
                <li key={d.id} className="ligne">
                  <span><b>{nom}</b> · {libelle} · {fcfa(d.amount)}
                    {declare && <span className="note"> · déclaré {MOYEN[declare.method]}{declare.reference ? ` réf. ${declare.reference}` : ""}</span>}</span>
                  {declare ? <span className="ligne">
                    <button className="btn petit principal" disabled={occupe} aria-label={`Valider le règlement ${de(nom)}`}
                      onClick={() => agir(() => api.validerPaiement(declare.id), `Dette ${de(nom)} réglée (${fcfa(declare.amount)}).`)}>Valider</button>
                    <button className="btn petit" disabled={occupe} aria-label={`Contester le règlement ${de(nom)}`}
                      onClick={() => setContestation({ id: declare.id, nom, motif: "" })}>Contester</button>
                  </span>
                    : <button className="btn petit" disabled={occupe} aria-label={`Encaisser la dette ${de(nom)}`}
                        onClick={() => setEncaissement({ id: crypto.randomUUID(), dette: d, nom, libelle })}>Encaisser</button>}
                </li>);
            })}
          </ul>
        </section>
      )}

      {encaissement && (
        <Confirmer titre={`Encaisser la dette ${de(encaissement.nom)}`} libelle="Oui, encaisser" occupe={occupe}
          message={`Encaisser ${fcfa(encaissement.dette.amount)} en espèces ${de(encaissement.nom)} pour ${encaissement.libelle} ?`}
          onNon={() => setEncaissement(null)}
          onOui={() => agir(async () => {
            const { id, dette } = encaissement;
            await api.saisirEspeces(id, dette.membership_id, dette.cycle_id, dette.amount, dette.id);
            setEncaissement(null);
          }, `Dette ${de(encaissement.nom)} réglée (${fcfa(encaissement.dette.amount)}).`)} />
      )}

      {contestation && (
        <div className="carte">
          <h3>Contester le paiement {de(contestation.nom)}</h3>
          <Champ label="Motif" value={contestation.motif} onChange={(e) => setContestation({ ...contestation, motif: e.target.value })} autoFocus />
          <div className="ligne">
            <button className="btn" onClick={() => setContestation(null)}>Annuler</button>
            <button className="btn principal" disabled={occupe || !contestation.motif.trim()} aria-label="Confirmer la contestation"
              onClick={() => agir(async () => { await api.contesterPaiement(contestation.id, contestation.motif.trim()); setContestation(null); },
                `Paiement ${de(contestation.nom)} contesté.`)}>Contester</button>
          </div>
        </div>
      )}
    </section>
  );
}

function LigneMembre({ l, occupe, onValider, onContester, onEspeces }: {
  l: LigneCycle; occupe: boolean; onValider: () => void; onContester: (paiementId: string) => void; onEspeces: () => void;
}) {
  const nom = l.membre.display_name; const p = l.enAttente;
  return (
    <li className={`carte membre ${l.etat}`}>
      <div className="ligne">
        <span><b>{nom}</b>{l.membre.status === "invite" && <span className="note"> · invité</span>}
          {l.membre.status === "retire" && <span className="note"> · parti</span>}</span>
        <span className={`pastille ${l.etat}`}>{LIBELLE_ETAT[l.etat]}</span>
      </div>
      {p && <p className="note">Déclaré : {fcfa(p.amount)} · {MOYEN[p.method]}{p.reference ? ` · réf. ${p.reference}` : ""} · {dateCourte(p.paid_on)}</p>}
      {l.valide > 0 && l.etat !== "paye" && <p className="note">Déjà validé : {fcfa(l.valide)}</p>}
      {l.etat === "partiel" && !p && <p className="note">Pour compléter : annulez ce paiement puis saisissez le montant total.</p>}
      {l.etat === "hors" && <p className="note">Arrivé(e) après l'ouverture du cycle : rien à payer pour celui-ci.</p>}
      <div className="ligne actions">
        {p && <>
          <button className="btn petit principal" disabled={occupe} aria-label={`Valider le paiement ${de(nom)}`} onClick={onValider}>Valider</button>
          <button className="btn petit" disabled={occupe} aria-label={`Contester le paiement ${de(nom)}`} onClick={() => onContester(p.id)}>Contester</button>
        </>}
        {/* Un seul paiement ordinaire par membre et par cycle en base : pas de seconde saisie si un paiement existe déjà */}
        {!p && l.compte && l.valide === 0 && <button className="btn petit" disabled={occupe} aria-label={`Saisir des espèces pour ${nom}`} onClick={onEspeces}>Espèces</button>}
        {l.dernierValide && !p && <button className="lien" disabled={occupe} aria-label={`Annuler le paiement ${de(nom)}`}
          onClick={() => onContester(l.dernierValide!.id)}>Annuler ce paiement</button>}
      </div>
    </li>
  );
}

function FormEspeces({ saisie, occupe, onChange, onAnnuler, onEnregistrer }: {
  saisie: NonNullable<Saisie>; occupe: boolean; onChange: (s: Saisie) => void; onAnnuler: () => void; onEnregistrer: (s: NonNullable<Saisie>) => void;
}) {
  const montant = parseInt(saisie.montant || "0", 10);
  return (
    <div className="carte">
      <h3>Espèces remises par {saisie.nom}</h3>
      <Champ label="Montant reçu (FCFA)" value={saisie.montant} inputMode="numeric" autoFocus
        onChange={(e) => onChange({ ...saisie, montant: e.target.value.replace(/\D/g, "") })} />
      <div className="ligne">
        <button className="btn" onClick={onAnnuler} disabled={occupe}>Annuler</button>
        <button className="btn principal" disabled={occupe || montant <= 0} aria-label="Enregistrer les espèces"
          onClick={() => onEnregistrer(saisie)}>Enregistrer</button>
      </div>
    </div>
  );
}

function NouveauCycle({ groupeId, frequence, occupe, onOuvrir }: {
  groupeId: string; frequence: VueGroupe["groupe"]["frequency"]; occupe: boolean; onOuvrir: (libelle: string, echeance: string | null) => void;
}) {
  const [libelle, setLibelle] = useState(() => libelleParDefaut(new Date(), frequence));
  const [echeance, setEcheance] = useState("");
  return (
    <form className="carte" data-groupe={groupeId} onSubmit={(e) => { e.preventDefault(); onOuvrir(libelle.trim(), echeance || null); }}>
      <h2>Aucun cycle en cours</h2>
      <Champ label="Libellé du cycle" value={libelle} onChange={(e) => setLibelle(e.target.value)} required />
      <Champ label="Date limite de paiement (facultatif)" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
      <button className="btn principal" disabled={occupe || !libelle.trim()}>Ouvrir le cycle</button>
    </form>
  );
}
