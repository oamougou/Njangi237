import { useCallback, useEffect, useState } from "react";
import { api, configuree, demo, stockage } from "./lib/api";
import { changerProfil, entrerDemo, profilDemo, quitterDemo, rechargerPage } from "./lib/demo/modeDemo";
import { demarrerEnvoi } from "./lib/envoi";
import { chargerMoi, oublierMoi } from "./lib/session";
import { lireRoute } from "./lib/routes";
import type { Personne } from "./lib/types";
import { BandeauDemo } from "./ui/BandeauDemo";
import { Connexion } from "./ui/Connexion";
import { Coque } from "./ui/Coque";
import { Amorcage } from "./ui/Amorcage";
import { Invitation } from "./ui/Invitation";

export default function App() {
  const [route, setRoute] = useState(() => lireRoute(location.hash));
  const [moi, setMoi] = useState<Personne | null | undefined>(undefined);

  useEffect(() => {
    const suivre = () => setRoute(lireRoute(location.hash));
    addEventListener("hashchange", suivre);
    return () => removeEventListener("hashchange", suivre);
  }, []);
  const rafraichir = useCallback(() => { chargerMoi(api, stockage).then(setMoi); }, []);
  useEffect(() => { rafraichir(); }, [rafraichir]);
  // Déclarations faites hors ligne : envoyées dès que la personne est connectée et à chaque retour du réseau
  const moiId = moi?.id;
  useEffect(() => (moiId ? demarrerEnvoi(api, stockage, moiId) : undefined), [moiId]);

  const bandeau = demo && <BandeauDemo profil={profilDemo()} onChanger={() => changerProfil()}
    onReinitialiser={() => { demo?.reinitialiser(); rechargerPage(); }} onQuitter={configuree ? () => quitterDemo() : undefined} />;
  let ecran;
  if (route.nom === "invitation" || route.nom === "nouveau-pin")
    ecran = <Invitation api={api} jeton={route.jeton} mode={route.nom} onFini={() => { location.hash = "#/"; rafraichir(); }} />;
  else if (route.nom === "amorcer" && !moi) ecran = <Amorcage api={api} onFini={() => { location.hash = "#/admin"; rafraichir(); }} />;
  else if (moi === undefined) ecran = <main className="ecran etroit"><p className="note">Chargement…</p></main>;
  else if (!moi) ecran = <Connexion api={api} onConnecte={rafraichir} onDemo={() => entrerDemo()} />;
  else ecran = <Coque api={api} moi={moi} route={route} stockage={stockage}
    onQuitter={async () => { await api.quitter(); oublierMoi(stockage); setMoi(null); location.hash = "#/"; }} />;
  return <>{bandeau}{ecran}</>;
}
