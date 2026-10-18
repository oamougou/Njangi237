import { useState } from "react";
import type { ProfilDemo } from "../lib/demo/modeDemo";

const NOM: Record<ProfilDemo, string> = { tina: "Tina (trésorière)", alice: "Alice (membre)" };

/** Rappel permanent du mode démo : profil courant, passage à l'autre profil, remise à zéro, sortie. */
export function BandeauDemo({ profil, onChanger, onReinitialiser, onQuitter }: {
  profil: ProfilDemo; onChanger: () => void; onReinitialiser: () => void; onQuitter?: () => void;
}) {
  const [confirmer, setConfirmer] = useState(false);
  const autre: ProfilDemo = profil === "tina" ? "alice" : "tina";
  return (
    <div className="bandeau-demo" role="region" aria-label="Mode démo">
      <p><b>Mode démo</b> · {NOM[profil]} · données fictives, rien n'est envoyé</p>
      <div className="actions-demo">
        <button className="btn petit" onClick={onChanger}>Passer en {NOM[autre]}</button>
        {confirmer
          ? <button className="btn petit" onClick={onReinitialiser}>Confirmer : tout remettre à zéro</button>
          : <button className="btn petit" onClick={() => setConfirmer(true)}>Réinitialiser la démo</button>}
        {onQuitter && <button className="btn petit" onClick={onQuitter}>Quitter la démo</button>}
      </div>
    </div>
  );
}
