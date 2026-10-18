import { ajouterPersonne, etatVide, type Ctx } from "../lib/demo/etat";
import { ajouterMembre, creerGroupe, rejoindre } from "../lib/demo/membres";

/** Tontine de 4 (5 000 FCFA, un bénéficiaire) : Tina trésorière (1), Alice (2) et Bob (3) actifs, Ines invitée (4). */
export function monde() {
  const e = etatVide();
  let n = 0;
  let t = Date.parse("2026-09-01T08:00:00Z");
  const ctx = (acteur: string): Ctx => ({ acteur, maintenant: () => new Date(t), id: () => `id-${++n}`, hasard: () => 0.42 });
  const avancer = (heures = 1) => { t += heures * 3_600_000; };
  const personne = (id: string, nom: string, tel: string) => { ajouterPersonne(e, { id, full_name: nom, phone: tel }); return ctx(id); };

  const tina = personne("u-tina", "Tina", "237690000001");
  const { groupId, membershipId: mTina } = creerGroupe(e, ctx("plateforme"), {
    nom: "Tontine test", type: "tontine", montant: 5000, frequence: "mensuelle", beneficiaires: 1,
    tresorier_nom: "Tina", tresorier_telephone: "690000001",
  });
  rejoindre(e, tina, mTina);
  avancer();
  const alice = personne("u-alice", "Alice", "237690000002");
  const mAlice = ajouterMembre(e, tina, groupId, "Alice", "690000002"); rejoindre(e, alice, mAlice);
  const bob = personne("u-bob", "Bob", "237690000003");
  const mBob = ajouterMembre(e, tina, groupId, "Bob", "690000003"); rejoindre(e, bob, mBob);
  const mInes = ajouterMembre(e, tina, groupId, "Ines", "690000004");
  avancer();
  return { e, ctx, avancer, groupId, tina, alice, bob, m: { tina: mTina, alice: mAlice, bob: mBob, ines: mInes } };
}
