import { useState } from "react";
import type { Api } from "../lib/types";
import { Champ, ChampPin } from "./Champ";

/** Création, une seule fois, du premier administrateur de la plateforme (numéro autorisé par le serveur). */
export function Amorcage({ api, onFini }: { api: Api; onFini: () => void }) {
  const [tel, setTel] = useState(""); const [nom, setNom] = useState("");
  const [pin, setPin] = useState(""); const [pin2, setPin2] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.amorcer(tel, nom.trim(), pin); onFini(); }
    catch (x) { setErr((x as Error).message); setPin(""); setPin2(""); }
    finally { setBusy(false); }
  };
  return (
    <main className="ecran etroit">
      <h1 className="marque">Njangi237</h1>
      <p className="sous">Création du compte administrateur</p>
      <form onSubmit={envoyer} className="carte">
        <Champ label="Votre numéro" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="6XX XX XX XX" required autoFocus />
        <Champ label="Votre nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <ChampPin label="Choisissez un PIN (6 chiffres)" valeur={pin} onChange={setPin} />
        <ChampPin label="Confirmez le PIN" valeur={pin2} onChange={setPin2} />
        {pin2.length === 6 && pin !== pin2 && <p className="alerte">Les deux PIN sont différents.</p>}
        {err && <p className="alerte">{err}</p>}
        <button className="btn principal" disabled={busy || !tel || !nom.trim() || pin.length !== 6 || pin !== pin2}>Créer mon compte</button>
      </form>
    </main>
  );
}
