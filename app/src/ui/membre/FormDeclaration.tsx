import { useState } from "react";
import type { MoyenPaiement } from "../../lib/types";
import { Champ } from "../Champ";

export interface SaisieDeclaration { montant: number; moyen: MoyenPaiement; reference: string | null; date: string }
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Formulaire de déclaration : moyen, montant, référence (obligatoire pour MoMo/OM), date. */
export function FormDeclaration({ titre, montant, montantFixe, occupe, onAnnuler, onDeclarer }: {
  titre: string; montant: number; montantFixe?: boolean; occupe: boolean; onAnnuler: () => void; onDeclarer: (s: SaisieDeclaration) => void;
}) {
  const [moyen, setMoyen] = useState<MoyenPaiement>("mtn_momo");
  const [somme, setSomme] = useState(String(montant));
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(aujourdhui());
  const mobile = moyen === "mtn_momo" || moyen === "orange_money";
  const valeur = parseInt(somme || "0", 10);
  const valide = valeur > 0 && (!mobile || reference.trim().length > 0) && !!date && date <= aujourdhui();
  return (
    <form className="carte" onSubmit={(e) => { e.preventDefault(); if (valide) onDeclarer({ montant: valeur, moyen, reference: reference.trim() || null, date }); }}>
      <h3>{titre}</h3>
      <label className="champ"><span>Moyen de paiement</span>
        <select value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenPaiement)}>
          <option value="mtn_momo">MTN MoMo</option><option value="orange_money">Orange Money</option>
          <option value="especes">Espèces (remises au trésorier)</option><option value="autre">Autre</option>
        </select></label>
      <Champ label="Montant (FCFA)" value={somme} inputMode="numeric" readOnly={montantFixe}
        onChange={(e) => setSomme(e.target.value.replace(/\D/g, ""))} />
      <Champ label="Référence de la transaction" value={reference} onChange={(e) => setReference(e.target.value)}
        placeholder={mobile ? "Ex. MP240912.1234.A56789" : "Facultatif"} aide={mobile ? "Obligatoire pour MoMo et Orange Money." : undefined} />
      <Champ label="Date du paiement" type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} />
      <div className="ligne">
        <button type="button" className="btn" onClick={onAnnuler} disabled={occupe}>Annuler</button>
        <button className="btn principal" disabled={occupe || !valide} aria-label="Envoyer la déclaration">Envoyer</button>
      </div>
    </form>
  );
}
