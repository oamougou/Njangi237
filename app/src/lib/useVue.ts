import { useCallback, useEffect, useRef, useState } from "react";
import { estReseau } from "./erreurs";
import { memoriser, relire, type Stockage } from "./horsLigne";

/**
 * Données d'un écran : la dernière version mémorisée s'affiche tout de suite, puis la version fraîche la remplace.
 * Sans réseau, on garde la mémoire (et sa date) ; les changements temps réel déclenchent un rechargement regroupé.
 * `cle` inclut l'identifiant de la personne : jamais la mémoire d'une autre (téléphone partagé). `null` = pas de mémoire.
 */
export function useVue<T>({ cle, charger, abonner, stockage }: {
  cle: string | null; charger: () => Promise<T>; abonner: (cb: () => void) => () => void; stockage: Stockage;
}) {
  const [vue, setVue] = useState<T | null>(() => (cle ? relire<T>(stockage, cle)?.donnees ?? null : null));
  const [le, setLe] = useState<string | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [err, setErr] = useState("");
  const chargerRef = useRef(charger); chargerRef.current = charger;

  const recharger = useCallback(() => {
    chargerRef.current().then((v) => {
      setVue(v); setLe(null); setHorsLigne(false); setErr("");
      if (cle) memoriser(stockage, cle, v);
    }).catch((e) => {
      if (estReseau(e)) {
        setHorsLigne(true);
        setLe(cle ? relire<T>(stockage, cle)?.le ?? null : null);
      } else setErr((e as Error).message);
    });
  }, [cle, stockage]);

  useEffect(() => { recharger(); }, [recharger]);

  useEffect(() => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const regroupe = () => { clearTimeout(minuterie); minuterie = setTimeout(recharger, 400); };
    const arreter = abonner(regroupe);
    const surLigne = () => recharger();
    const horsReseau = () => setHorsLigne(true);
    window.addEventListener("online", surLigne);
    window.addEventListener("offline", horsReseau);
    window.addEventListener("njangi:file", surLigne);
    return () => {
      clearTimeout(minuterie); arreter();
      window.removeEventListener("online", surLigne);
      window.removeEventListener("offline", horsReseau);
      window.removeEventListener("njangi:file", surLigne);
    };
    // abonner change à chaque rendu chez l'appelant : on ne s'abonne qu'une fois par vue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recharger]);

  return { vue, le, horsLigne, err, recharger };
}
