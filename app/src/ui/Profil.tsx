import { useState } from "react";
import { afficherTelephone } from "../lib/telephone";
import type { Api, Personne } from "../lib/types";
import { ChampPin } from "./Champ";

export function Profil({ api, moi, onQuitter }: { api: Api; moi: Personne; onQuitter: () => void }) {
  const [ancien, setAncien] = useState(""); const [nouveau, setNouveau] = useState(""); const [conf, setConf] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(""); setMsg("");
    try { await api.changerPin(ancien, nouveau); setMsg("PIN changé."); setAncien(""); setNouveau(""); setConf(""); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section>
      <div className="carte"><h2>{moi.full_name}</h2><p className="note">{afficherTelephone(moi.phone)}</p></div>
      <form onSubmit={envoyer} className="carte">
        <h3>Changer mon PIN</h3>
        <ChampPin label="PIN actuel" valeur={ancien} onChange={setAncien} />
        <ChampPin label="Nouveau PIN" valeur={nouveau} onChange={setNouveau} />
        <ChampPin label="Confirmez le nouveau PIN" valeur={conf} onChange={setConf} />
        {conf.length === 6 && conf !== nouveau && <p className="alerte">Les deux PIN sont différents.</p>}
        {err && <p className="alerte">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        <button className="btn principal" disabled={busy || ancien.length !== 6 || nouveau.length !== 6 || nouveau !== conf}>Changer le PIN</button>
      </form>
      <button className="btn" onClick={onQuitter}>Se déconnecter</button>
    </section>
  );
}
