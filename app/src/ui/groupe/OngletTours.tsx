import { useState } from "react";
import { bilanCycle } from "../../lib/cycle";
import { dateCourte, fcfa } from "../../lib/format";
import { deplacer, etatTour, montantPropose } from "../../lib/tours";
import type { Api, MoyenPaiement, Remise, VueGroupe } from "../../lib/types";
import { Champ } from "../Champ";
import { Confirmer } from "../Confirmer";

const MOYENS: [MoyenPaiement, string][] = [["especes", "Espèces"], ["mtn_momo", "MTN MoMo"], ["orange_money", "Orange Money"], ["autre", "Autre"]];
const ecartTexte = (e: number) => (e === 0 ? "" : ` Écart avec le montant attendu : ${e > 0 ? "+" : "−"}${fcfa(Math.abs(e))}.`);

interface SaisieRemise { remise: Remise; nom: string; montant: string; moyen: MoyenPaiement; reference: string }

/** Onglet Tours du trésorier d'une tontine : ordre, tirage, échanges, remises de la cagnotte, nouveau tour. */
export function OngletTours({ api, vue, recharger }: { api: Api; vue: VueGroupe; recharger: () => void }) {
  const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [occupe, setOccupe] = useState(false);
  const [brouillon, setBrouillon] = useState<string[] | null>(null);
  const [confirmer, setConfirmer] = useState<"tirage" | "nouveau" | null>(null);
  const [echange, setEchange] = useState<{ a: string; b: string } | null>(null);
  const [saisie, setSaisie] = useState<SaisieRemise | null>(null);
  const [remplacement, setRemplacement] = useState<{ remise: Remise; par: string } | null>(null);

  const g = vue.groupe;
  if (g.type !== "tontine") return <p className="note">Les tours ne concernent que les tontines.</p>;
  const etat = etatTour(vue.membres, vue.remises, g.current_round);
  const nom = (id: string) => vue.membres.find((m) => m.id === id)?.display_name ?? "?";
  const cycle = (id: string) => vue.cycles.find((c) => c.id === id);
  const nonServis = etat.lignes.filter((l) => !l.servi).map((l) => l.membre);
  const dernierClos = [...vue.cycles].reverse().find((c) => c.status === "clos");
  const reels = etat.lignes.map((l) => l.membre.id);
  // Brouillon périmé (un autre trésorier a changé les membres ou ouvert un cycle) : on revient à l'ordre réel
  const brouillonValide = brouillon !== null && !g.order_locked && brouillon.length === reels.length
    && brouillon.every((id) => reels.includes(id));
  const ids = brouillonValide ? brouillon : reels;
  const cycleOuvert = vue.cycles.some((c) => c.status === "ouvert");

  const agir = async (f: () => Promise<string>) => {
    setOccupe(true); setErr(""); setInfo("");
    try { setInfo(await f()); recharger(); } catch (e) { setErr((e as Error).message); } finally { setOccupe(false); }
  };

  const ouvrirRemise = (r: Remise) => {
    const c = cycle(r.cycle_id);
    const connu = c && (c.status === "ouvert" || c.id === dernierClos?.id);
    const collecte = connu ? bilanCycle(c, vue.membres, vue.paiements).collecte : null;
    setSaisie({ remise: r, nom: nom(r.membership_id), montant: String(montantPropose(r, collecte, g.beneficiaries_per_cycle)),
      moyen: "especes", reference: "" });
  };
  const montant = saisie ? parseInt(saisie.montant || "0", 10) : 0;
  const saisieValide = saisie && montant > 0
    && !((saisie.moyen === "mtn_momo" || saisie.moyen === "orange_money") && !saisie.reference.trim());

  return (
    <section>
      {err && <p className="alerte flottante" role="alert">{err}</p>}
      {info && <p className="ok">{info}</p>}

      {etat.termine && (
        <div className="carte succes">
          <h3>Tour {g.current_round} terminé 🎉</h3>
          <p className="note">Tous les membres ont reçu leur part.</p>
          {cycleOuvert && <p className="note">Clôturez d'abord le cycle en cours (onglet Cycle).</p>}
          <button className="btn principal" disabled={cycleOuvert} onClick={() => setConfirmer("nouveau")}>Commencer le tour {g.current_round + 1}</button>
        </div>)}

      <div className="carte">
        <div className="ligne"><h3>Ordre des tours</h3><span className="note">Tour {g.current_round}</span></div>
        <p className="note">{g.order_locked
          ? "Ordre verrouillé depuis l'ouverture du premier cycle du tour : seul l'échange de deux tours reste possible."
          : "Réglez l'ordre à la main ou tirez-le au sort. Il sera verrouillé à l'ouverture du premier cycle."}</p>
        <ol className="liste tours" aria-label="Ordre des tours">
          {ids.map((id, i) => {
            const l = etat.lignes.find((x) => x.membre.id === id);
            if (!l) return null;
            const n = l.membre.display_name;
            return (
              <li key={id} className="ligne">
                <span><b>{i + 1}.</b> {n}</span>
                {g.order_locked ? (
                  <span className={l.servi ? "pastille paye" : l.prevu ? "pastille declare" : "note"}>
                    {l.servi ? `A reçu sa part ✓${l.servi.paid_on ? ` (${dateCourte(l.servi.paid_on).slice(0, 5)})` : ""}`
                      : l.prevu ? `Bénéficiaire · ${cycle(l.prevu.cycle_id)?.label ?? "cycle"}` : ""}
                  </span>
                ) : (
                  <span className="actions" style={{ margin: 0 }}>
                    <button className="btn petit" aria-label={`Monter ${n}`} disabled={i === 0}
                      onClick={() => setBrouillon(deplacer(ids, i, -1))}>↑</button>
                    <button className="btn petit" aria-label={`Descendre ${n}`} disabled={i === ids.length - 1}
                      onClick={() => setBrouillon(deplacer(ids, i, 1))}>↓</button>
                  </span>)}
              </li>);
          })}
        </ol>
        {!g.order_locked ? (
          <div className="actions">
            <button className="btn principal" disabled={!brouillonValide || occupe}
              onClick={() => agir(async () => { await api.ordonnerTours(g.id, ids); setBrouillon(null); return "Ordre des tours enregistré."; })}>
              Enregistrer l'ordre</button>
            <button className="btn" disabled={occupe} onClick={() => setConfirmer("tirage")}>Tirer au sort</button>
          </div>
        ) : !echange && nonServis.length >= 2 && (
          <button className="btn" onClick={() => setEchange({ a: "", b: "" })}>Échanger deux tours</button>)}
      </div>

      {confirmer === "tirage" && <Confirmer titre="Tirer au sort l'ordre ?" libelle="Tirer au sort" occupe={occupe}
        message="Le tirage est fait par le serveur et inscrit au journal, visible de tous les membres. Il remplace l'ordre actuel."
        onNon={() => setConfirmer(null)}
        onOui={() => agir(async () => {
          const noms = await api.tirerAuSort(g.id); setConfirmer(null); setBrouillon(null);
          return `Ordre tiré au sort : ${noms.map((x, i) => `${i + 1}. ${x}`).join(", ")}`;
        })} />}

      {confirmer === "nouveau" && <Confirmer titre={`Commencer le tour ${g.current_round + 1} ?`} libelle="Commencer" occupe={occupe}
        message="L'ordre sera de nouveau modifiable (à la main ou par tirage) jusqu'à l'ouverture du premier cycle."
        onNon={() => setConfirmer(null)}
        onOui={() => agir(async () => {
          const n = await api.nouveauTour(g.id); setConfirmer(null);
          return `Tour ${n} commencé : réglez l'ordre ou tirez-le au sort, puis ouvrez le premier cycle.`;
        })} />}

      {echange && (
        <div className="carte confirmer">
          <h3>Échanger deux tours</h3>
          {(["a", "b"] as const).map((k) => (
            <label key={k} className="champ"><span>{k === "a" ? "Premier membre" : "Second membre"}</span>
              <select value={echange[k]} onChange={(e) => setEchange({ ...echange, [k]: e.target.value })}>
                <option value="">Choisir…</option>
                {nonServis.filter((m) => m.id !== (k === "a" ? echange.b : echange.a))
                  .map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select></label>))}
          <p className="note">L'échange est inscrit au journal, visible des membres.</p>
          <div className="ligne">
            <button className="btn" onClick={() => setEchange(null)} disabled={occupe}>Annuler</button>
            <button className="btn principal" disabled={!echange.a || !echange.b || occupe}
              onClick={() => agir(async () => {
                await api.echangerTours(echange.a, echange.b); setEchange(null);
                return `Tours échangés entre ${nom(echange.a)} et ${nom(echange.b)}.`;
              })}>Échanger</button>
          </div>
        </div>)}

      {etat.aRemettre.length > 0 && (
        <div className="carte">
          <h3>Cagnottes à remettre</h3>
          <ul className="liste">{etat.aRemettre.map((r) => (
            <li key={r.id} className="carte" style={{ marginBottom: 8 }}>
              <div className="ligne"><b>{nom(r.membership_id)}</b><span className="note">{cycle(r.cycle_id)?.label ?? ""}</span></div>
              <p className="note">Montant attendu : {fcfa(r.amount_expected)}</p>
              <div className="actions">
                <button className="btn principal petit" onClick={() => ouvrirRemise(r)}>Remettre la cagnotte à {nom(r.membership_id)}</button>
                <button className="btn petit" aria-label={`Remplacer ${nom(r.membership_id)}`}
                  onClick={() => setRemplacement({ remise: r, par: "" })}>Remplacer</button>
              </div>
            </li>))}
          </ul>
        </div>)}

      {remplacement && (
        <div className="carte confirmer">
          <h3>Remplacer {nom(remplacement.remise.membership_id)}</h3>
          <label className="champ"><span>Nouveau bénéficiaire</span>
            <select value={remplacement.par} onChange={(e) => setRemplacement({ ...remplacement, par: e.target.value })}>
              <option value="">Choisir…</option>
              {nonServis.filter((m) => m.id !== remplacement.remise.membership_id)
                .map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select></label>
          <p className="note">Les deux membres échangent leur tour ; l'échange est inscrit au journal.</p>
          <div className="ligne">
            <button className="btn" onClick={() => setRemplacement(null)} disabled={occupe}>Annuler</button>
            <button className="btn principal" disabled={!remplacement.par || occupe}
              onClick={() => agir(async () => {
                await api.remplacerBeneficiaire(remplacement.remise.id, remplacement.par); setRemplacement(null);
                return `${nom(remplacement.par)} devient bénéficiaire à la place de ${nom(remplacement.remise.membership_id)}.`;
              })}>Confirmer le remplacement</button>
          </div>
        </div>)}

      {saisie && (
        <form className="carte confirmer" onSubmit={(e) => {
          e.preventDefault();
          if (!saisieValide) return;
          agir(async () => {
            const { ecart } = await api.enregistrerRemise(saisie.remise.id, montant, saisie.moyen, saisie.reference.trim() || null);
            setSaisie(null);
            return `Cagnotte remise à ${saisie.nom} : ${fcfa(montant)}.${ecartTexte(ecart)}`;
          });
        }}>
          <h3>Remettre la cagnotte à {saisie.nom}</h3>
          <Champ label="Montant remis (FCFA)" inputMode="numeric" value={saisie.montant}
            onChange={(e) => setSaisie({ ...saisie, montant: e.target.value.replace(/\D/g, "") })}
            aide={`Proposé : collecté ÷ ${g.beneficiaries_per_cycle} bénéficiaire${g.beneficiaries_per_cycle > 1 ? "s" : ""}. Attendu : ${fcfa(saisie.remise.amount_expected)}.`} />
          <label className="champ"><span>Moyen</span>
            <select value={saisie.moyen} onChange={(e) => setSaisie({ ...saisie, moyen: e.target.value as MoyenPaiement })}>
              {MOYENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          {saisie.moyen !== "especes" && <Champ label="Référence de la transaction" value={saisie.reference}
            onChange={(e) => setSaisie({ ...saisie, reference: e.target.value })} />}
          <div className="ligne">
            <button type="button" className="btn" onClick={() => setSaisie(null)} disabled={occupe}>Annuler</button>
            <button className="btn principal" disabled={!saisieValide || occupe}>Enregistrer la remise</button>
          </div>
        </form>)}
    </section>
  );
}
