import { useEffect, useState } from "react";
import { libelleJournal } from "../../lib/journal";
import type { Api, EntreeJournal } from "../../lib/types";

const PAGE = 50;
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Journal du groupe (trésorier) : de la plus récente à la plus ancienne action, par pages de 50. */
export function OngletJournal({ api, groupId }: { api: Api; groupId: string }) {
  const [entrees, setEntrees] = useState<EntreeJournal[] | null>(null);
  const [encore, setEncore] = useState(false);
  const [err, setErr] = useState(""); const [occupe, setOccupe] = useState(false);

  const charger = async (avant?: number) => {
    setOccupe(true); setErr("");
    try {
      const page = await api.lireJournal(groupId, avant);
      setEntrees((e) => (avant === undefined ? page : [...(e ?? []), ...page]));
      setEncore(page.length === PAGE);
    } catch (e) { setErr((e as Error).message); } finally { setOccupe(false); }
  };
  useEffect(() => { void charger(); }, [groupId]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      {err && <p className="alerte" role="alert">{err}</p>}
      {entrees === null ? (!err && <p className="note">Chargement…</p>)
        : entrees.length === 0 ? <p className="note">Aucune action enregistrée pour l'instant.</p>
        : (
          <ul className="liste">{entrees.map((e) => (
            <li key={e.id} className="carte" style={{ gap: 4 }}>
              <span>{libelleJournal(e)}</span>
              <span className="note">{quand(e.created_at)}{e.auteur ? ` · ${e.auteur}` : ""}</span>
              {e.visible && <span className="pastille" style={{ justifySelf: "start" }}>Visible des membres</span>}
            </li>))}
          </ul>)}
      {encore && <button className="btn" disabled={occupe} onClick={() => charger(entrees![entrees!.length - 1]!.id)}>Voir plus</button>}
    </section>
  );
}
