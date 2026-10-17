import { useState } from "react";
import type { Api } from "../lib/types";
import { Champ, ChampPin } from "./Champ";

export function Connexion({ api, onConnecte, onDemo }: { api: Api; onConnecte: () => void; onDemo?: () => void }) {
  const [tel, setTel] = useState(""); const [pin, setPin] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.connexion(tel, pin); onConnecte(); }
    catch (x) { setErr((x as Error).message); setPin(""); }
    finally { setBusy(false); }
  };
  return (
    <main className="ecran etroit">
      <h1 className="marque">Njangi237</h1>
      <p className="sous">Tontines et cotisations</p>
      <form onSubmit={envoyer} className="carte">
        <Champ label="Numéro de téléphone" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel"
          autoComplete="tel" placeholder="6XX XX XX XX" required autoFocus />
        <ChampPin label="Code PIN" valeur={pin} onChange={setPin} />
        {err && <p className="alerte">{err}</p>}
        <button className="btn principal" disabled={busy || pin.length !== 6 || !tel}>Se connecter</button>
      </form>
      <p className="note">PIN oublié ? Demandez un lien à votre trésorier.</p>
      {onDemo && <button className="btn" type="button" onClick={onDemo}>Essayer la démo</button>}
      <p className="note"><a className="lien" href="v1/">Vous utilisiez l'ancienne version ? Vos données sont ici →</a></p>
    </main>
  );
}
