import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import { lireRoute } from "./lib/routes";
import type { Personne } from "./lib/types";
import { Connexion } from "./ui/Connexion";
import { Coque } from "./ui/Coque";
import { Invitation } from "./ui/Invitation";

export default function App() {
  const [route, setRoute] = useState(() => lireRoute(location.hash));
  const [moi, setMoi] = useState<Personne | null | undefined>(undefined);

  useEffect(() => {
    const suivre = () => setRoute(lireRoute(location.hash));
    addEventListener("hashchange", suivre);
    return () => removeEventListener("hashchange", suivre);
  }, []);
  const rafraichir = useCallback(() => { api?.session().then(setMoi).catch(() => setMoi(null)); }, []);
  useEffect(() => { rafraichir(); }, [rafraichir]);

  if (!api) return <main className="ecran etroit"><h1 className="marque">Njangi237</h1>
    <p className="alerte">Application non configurée (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).</p></main>;

  if (route.nom === "invitation" || route.nom === "nouveau-pin")
    return <Invitation api={api} jeton={route.jeton} mode={route.nom} onFini={() => { location.hash = "#/"; rafraichir(); }} />;
  if (moi === undefined) return <main className="ecran etroit"><p className="note">Chargement…</p></main>;
  if (!moi) return <Connexion api={api} onConnecte={rafraichir} />;
  const a = api;   // non nul ici ; figé pour la fonction différée ci-dessous
  return <Coque api={a} moi={moi} route={route} onQuitter={async () => { await a.quitter(); setMoi(null); location.hash = "#/"; }} />;
}
