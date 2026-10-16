import { useMemo } from "react";
import { stockageNavigateur } from "../lib/horsLigne";
import type { Route } from "../lib/routes";
import type { Api, Personne } from "../lib/types";
import { Admin } from "./Admin";
import { Groupe } from "./groupe/Groupe";
import { MesGroupes } from "./MesGroupes";
import { Profil } from "./Profil";

/** En-tête, navigation et écran courant d'une personne connectée. */
export function Coque({ api, moi, route, onQuitter }: { api: Api; moi: Personne; route: Route; onQuitter: () => void }) {
  const stockage = useMemo(stockageNavigateur, []);
  const onglet = route.nom === "profil" || (route.nom === "admin" && moi.admin) ? route.nom : "accueil";
  return (
    <>
      <header className="haut">
        <div className="ligne"><h1 className="logo">Njangi237</h1><span className="note clair">{moi.full_name}</span></div>
        <nav>
          <a href="#/" className={onglet === "accueil" ? "actif" : ""}>Mes groupes</a>
          {moi.admin && <a href="#/admin" className={onglet === "admin" ? "actif" : ""}>Administration</a>}
          <a href="#/profil" className={onglet === "profil" ? "actif" : ""}>Profil</a>
        </nav>
      </header>
      <main className="ecran">
        {onglet === "accueil" && (route.nom === "groupe"
          ? <Groupe key={route.id} api={api} id={route.id} onglet={route.onglet} personId={moi.id} stockage={stockage} />
          : <MesGroupes api={api} personId={moi.id} stockage={stockage} nom={moi.full_name} />)}
        {onglet === "admin" && <Admin api={api} />}
        {onglet === "profil" && <Profil api={api} moi={moi} onQuitter={onQuitter} />}
      </main>
    </>
  );
}
