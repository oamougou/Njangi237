import { useEffect, useState } from "react";
import type { Api, Apercu } from "../lib/types";
import { Champ, ChampPin } from "./Champ";

/** Écran ouvert depuis un lien WhatsApp : rejoindre un groupe, ou choisir un nouveau PIN. */
export function Invitation({ api, jeton, mode, onFini }: { api: Api; jeton: string; mode: "invitation" | "nouveau-pin"; onFini: () => void }) {
  const [info, setInfo] = useState<Apercu | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [nom, setNom] = useState(""); const [pin, setPin] = useState(""); const [pin2, setPin2] = useState("");

  useEffect(() => {
    api.apercu(jeton).then((a) => {
      const attendu = mode === "invitation" ? "invitation" : "reinitialisation";
      if (a.type !== attendu) throw new Error("Lien invalide ou expiré");
      setInfo(a); setNom(a.nom);
    }).catch((e) => setErr((e as Error).message));
  }, [api, jeton, mode]);

  const nouveauPin = mode === "nouveau-pin" || !info?.compte_existant;
  const valide = pin.length === 6 && (!nouveauPin || pin === pin2);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (mode === "invitation") await api.accepter(jeton, pin, info?.compte_existant ? undefined : nom.trim());
      else await api.nouveauPin(jeton, pin);
      onFini();
    } catch (x) { setErr((x as Error).message); setPin(""); setPin2(""); }
    finally { setBusy(false); }
  };

  if (!info) return (
    <main className="ecran etroit">
      <h1 className="marque">Njangi237</h1>
      {err ? <><p className="alerte">{err}</p><p className="note">Demandez un nouveau lien à votre trésorier.</p>
        <a className="btn" href="#/">Aller à la connexion</a></> : <p className="note">Vérification du lien…</p>}
    </main>
  );

  return (
    <main className="ecran etroit">
      <h1 className="marque">Njangi237</h1>
      <form onSubmit={envoyer} className="carte">
        {mode === "invitation" ? <>
          <h2>{info.groupe}</h2>
          <p>{info.invite_par ? `${info.invite_par} vous invite à rejoindre ce groupe.` : "Vous êtes invité(e) à rejoindre ce groupe."}</p>
          {info.compte_existant
            ? <p className="note">Vous avez déjà un compte Njangi237 : entrez votre PIN habituel.</p>
            : <Champ label="Votre nom" value={nom} onChange={(e) => setNom(e.target.value)} required />}
        </> : <>
          <h2>Nouveau PIN</h2>
          <p>Bonjour {info.nom}, choisissez votre nouveau code PIN.</p>
        </>}
        <ChampPin label={nouveauPin ? "Choisissez un PIN (6 chiffres)" : "Votre PIN"} valeur={pin} onChange={setPin} autoFocus />
        {nouveauPin && <ChampPin label="Confirmez le PIN" valeur={pin2} onChange={setPin2} />}
        {nouveauPin && pin2.length === 6 && pin !== pin2 && <p className="alerte">Les deux PIN sont différents.</p>}
        {err && <p className="alerte">{err}</p>}
        <button className="btn principal" disabled={busy || !valide || (mode === "invitation" && nouveauPin && !nom.trim())}>
          {mode === "invitation" ? "Rejoindre le groupe" : "Enregistrer mon PIN"}</button>
      </form>
    </main>
  );
}
