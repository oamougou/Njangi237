import { useRef, useState } from "react";
import { fcfa } from "../../lib/format";
import { afficherTelephone } from "../../lib/telephone";
import type { Api, ApercuRetrait, LienEnvoye, Membre, VueGroupe } from "../../lib/types";
import { Champ } from "../Champ";
import { Confirmer } from "../Confirmer";
import { Lien } from "../Lien";
import { ImportContacts } from "./ImportContacts";

export function OngletMembres({ api, vue, recharger }: { api: Api; vue: VueGroupe; recharger: () => void }) {
  const [nom, setNom] = useState(""); const [tel, setTel] = useState("");
  const [envoi, setEnvoi] = useState<{ lien: LienEnvoye; titre: string } | null>(null);
  const [retrait, setRetrait] = useState<{ membre: Membre; apercu: ApercuRetrait } | null>(null);
  const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [occupe, setOccupe] = useState(false);

  // Référence (et non état) : un double clic arrive avant que React ait redessiné le bouton désactivé
  const enCours = useRef(false);
  const agir = async (f: () => Promise<unknown>, ok = "") => {
    if (enCours.current) return;
    enCours.current = true; setOccupe(true); setErr(""); setInfo("");
    try { await f(); if (ok) setInfo(ok); recharger(); }
    catch (x) { setErr((x as Error).message); }
    finally { enCours.current = false; setOccupe(false); }
  };

  const ajouter = (e: React.FormEvent) => {
    e.preventDefault();
    agir(async () => {
      const id = await api.ajouterMembre(vue.groupe.id, nom.trim(), tel);
      setEnvoi({ lien: await api.inviter(id, "invitation"), titre: `${nom.trim()} ajouté(e) : envoyez-lui son invitation` });
      setNom(""); setTel("");
    });
  };
  const lien = (m: Membre, type: "invitation" | "reinitialisation") => agir(async () => {
    setEnvoi({ lien: await api.inviter(m.id, type), titre: type === "invitation" ? `Invitation de ${m.display_name}` : `Nouveau PIN pour ${m.display_name}` });
  });
  const preparerRetrait = (m: Membre) => agir(async () => setRetrait({ membre: m, apercu: await api.apercuRetrait(m.id) }));

  const presents = vue.membres.filter((m) => m.status !== "retire");
  const partis = vue.membres.filter((m) => m.status === "retire");

  return (
    <section>
      {err && <p className="alerte">{err}</p>}
      {info && <p className="ok">{info}</p>}
      {envoi && <Lien envoi={envoi.lien} titre={envoi.titre} />}
      {retrait && (
        <Confirmer titre={`Retirer ${retrait.membre.display_name}`} libelle="Oui, retirer" occupe={occupe}
          message={messageRetrait(retrait.membre, retrait.apercu)} onNon={() => setRetrait(null)}
          onOui={() => agir(async () => { await api.retirerMembre(retrait.membre.id); setRetrait(null); }, `${retrait.membre.display_name} retiré(e) du groupe.`)} />
      )}

      <ImportContacts api={api} vue={vue} recharger={recharger} />

      <form className="carte" onSubmit={ajouter}>
        <h3>Ajouter un membre</h3>
        <Champ label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <Champ label="Numéro" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="6XX XX XX XX" required />
        <button className="btn principal" disabled={occupe || !nom.trim() || !tel.trim()}>Ajouter et inviter</button>
      </form>

      <ul className="liste">
        {presents.map((m) => (
          <li key={m.id} className="carte membre">
            <div className="ligne">
              <span><b>{m.display_name}</b> <span className="note">{afficherTelephone(m.phone)}</span></span>
              {m.role === "tresorier" && <span className="pastille tresorier">Trésorier</span>}
            </div>
            {m.status === "invite" && <p className="note">Invitation en attente</p>}
            <div className="ligne actions">
              {m.status === "invite"
                ? <button className="btn petit" disabled={occupe} aria-label={`Renvoyer l'invitation à ${m.display_name}`} onClick={() => lien(m, "invitation")}>Renvoyer l'invitation</button>
                : <button className="btn petit" disabled={occupe} aria-label={`Lien nouveau PIN pour ${m.display_name}`} onClick={() => lien(m, "reinitialisation")}>Nouveau PIN</button>}
              {m.role === "membre"
                ? <button className="lien" disabled={occupe} aria-label={`Nommer ${m.display_name} trésorier`}
                    onClick={() => agir(() => api.changerRole(m.id, "tresorier"), `${m.display_name} est trésorier.`)}>Nommer trésorier</button>
                : <button className="lien" disabled={occupe} aria-label={`Retirer le rôle de trésorier à ${m.display_name}`}
                    onClick={() => agir(() => api.changerRole(m.id, "membre"), `${m.display_name} n'est plus trésorier.`)}>Retirer le rôle</button>}
              <button className="lien danger" disabled={occupe} aria-label={`Retirer ${m.display_name}`} onClick={() => preparerRetrait(m)}>Retirer</button>
            </div>
          </li>))}
      </ul>

      {partis.length > 0 && (
        <details className="carte"><summary>Membres partis ({partis.length})</summary>
          <ul className="liste">{partis.map((m) => (
            <li key={m.id} className="ligne"><span>{m.display_name}</span>
              {m.left_balance ? <span className="note">doit encore {fcfa(m.left_balance)}</span> : <span className="note">à jour</span>}</li>))}
          </ul></details>
      )}
    </section>
  );
}

function messageRetrait(m: Membre, a: ApercuRetrait): string {
  const parts = [`${m.display_name} ne fera plus partie du groupe.`];
  if (a.deja_servi) parts.push(`Il/elle a déjà reçu sa part : il reste ${a.cycles_restants} cycle(s) à payer, soit ${fcfa(a.montant_restant)}.`);
  else if (a.montant_restant > 0) parts.push(`Cotisation du cycle en cours encore due : ${fcfa(a.montant_restant)}.`);
  if (a.dettes > 0) parts.push(`Dettes non réglées : ${fcfa(a.dettes)}.`);
  parts.push("Ces montants resteront visibles dans la liste des membres partis.");
  return parts.join(" ");
}
