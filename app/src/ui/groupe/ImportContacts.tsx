import { useRef, useState } from "react";
import { choisirContacts, contactsDisponibles, trierContacts } from "../../lib/contacts";
import type { Api, VueGroupe } from "../../lib/types";

type Ajoute = { nom: string; whatsapp: string | null };
type Bilan = { ajoutes: Ajoute[]; ignores: { nom: string; raison: string }[] };

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Ajout de membres depuis le carnet d'adresses (Chrome Android). Les invitations sont préparées tout de suite :
 * chaque lien WhatsApp est un vrai lien, ouvert par un toucher (les navigateurs bloquent les ouvertures en rafale).
 */
export function ImportContacts({ api, vue, recharger }: { api: Api; vue: VueGroupe; recharger: () => void }) {
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [occupe, setOccupe] = useState(false);
  const enCours = useRef(false);
  if (!contactsDisponibles()) return null;

  const importer = async () => {
    if (enCours.current) return;
    enCours.current = true; setOccupe(true);
    try {
      const contacts = await choisirContacts();
      if (!contacts.length) return;
      const presents = vue.membres.filter((m) => m.status !== "retire").map((m) => m.phone);
      const tri = trierContacts(contacts, presents);
      const resultat: Bilan = { ajoutes: [], ignores: [...tri.ignores] };
      for (const c of tri.candidats) {
        try {
          const id = await api.ajouterMembre(vue.groupe.id, c.nom, c.telephone);
          let whatsapp: string | null = null;
          try { whatsapp = (await api.inviter(id, "invitation")).whatsapp; } catch { /* lien renvoyable depuis la liste */ }
          resultat.ajoutes.push({ nom: c.nom, whatsapp });
        } catch (e) {
          resultat.ignores.push({ nom: c.nom, raison: (e as Error).message });
        }
      }
      setBilan(resultat);
      recharger();
    } finally {
      enCours.current = false; setOccupe(false);
    }
  };

  return (
    <>
      <button className="btn" disabled={occupe} onClick={importer}>{occupe ? "Import en cours…" : "Importer depuis les contacts"}</button>
      {bilan && (
        <section className="carte succes" role="region" aria-label="Import des contacts">
          <h3>{pluriel(bilan.ajoutes.length, "ajouté")}{bilan.ignores.length ? `, ${pluriel(bilan.ignores.length, "ignoré")}` : ""}</h3>
          {bilan.ajoutes.length > 0 && <p className="note">Envoyez à chacun son invitation (un message par toucher) :</p>}
          <ul className="liste">
            {bilan.ajoutes.map((a) => (
              <li key={a.nom}>
                {a.whatsapp
                  ? <a className="btn" href={a.whatsapp} target="_blank" rel="noreferrer"
                      aria-label={`Envoyer l'invitation à ${a.nom} sur WhatsApp`}>Inviter {a.nom} sur WhatsApp</a>
                  : <span className="note">{a.nom} : invitation à renvoyer depuis la liste ci-dessous</span>}
              </li>))}
          </ul>
          {bilan.ignores.length > 0 && (
            <ul className="note">{bilan.ignores.map((i, k) => <li key={k}>{i.nom} : {i.raison}</li>)}</ul>)}
          <button className="lien" onClick={() => setBilan(null)}>Fermer</button>
        </section>
      )}
    </>
  );
}
