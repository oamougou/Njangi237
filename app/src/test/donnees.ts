import type { VueGroupe, VueMembre } from "../lib/types";

/** Tontine de 4 membres (Tina trésorière), cycle d'octobre ouvert : Tina a payé, Alice a déclaré, Bob et Ines sont en retard. */
export function vueTest(): VueGroupe {
  const base = { person_id: null, left_balance: null, created_at: "2026-09-01T00:00:00Z" };
  return {
    role: "tresorier",
    groupe: { id: "g1", name: "Tontine des amis", type: "tontine", amount: 5000, frequency: "mensuelle", beneficiaries_per_cycle: 1, current_round: 1 },
    membres: [
      { ...base, id: "m-tina", display_name: "Tina", phone: "237690000002", role: "tresorier", status: "actif", position: 1, person_id: "u-tina" },
      { ...base, id: "m-alice", display_name: "Alice", phone: "237690000003", role: "membre", status: "actif", position: 2, person_id: "u-alice" },
      { ...base, id: "m-bob", display_name: "Bob", phone: "237690000004", role: "membre", status: "actif", position: 3, person_id: "u-bob" },
      { ...base, id: "m-ines", display_name: "Ines", phone: "237690000009", role: "membre", status: "invite", position: 4 },
    ],
    cycles: [{ id: "c-oct", round: 1, number: 1, label: "Octobre 2026", due_date: "2026-10-30", amount_expected: 5000,
      status: "ouvert", opened_at: "2026-10-01T08:00:00Z", closed_at: null }],
    paiements: [
      { id: "p-tina", cycle_id: "c-oct", membership_id: "m-tina", debt_id: null, amount: 5000, method: "especes", reference: null,
        paid_on: "2026-10-02", status: "valide", contest_reason: null, created_at: "2026-10-02T09:00:00Z" },
      { id: "p-alice", cycle_id: "c-oct", membership_id: "m-alice", debt_id: null, amount: 5000, method: "mtn_momo", reference: "MP42",
        paid_on: "2026-10-05", status: "declare", contest_reason: null, created_at: "2026-10-05T09:00:00Z" },
    ],
    dettes: [],
  };
}

/** Alice, membre de la tontine : cycle d'octobre ouvert (Tina bénéficiaire), rien payé ; dette de septembre de 5 000. */
export function vueMembreTest(): VueMembre {
  const v = vueTest();
  const alice = v.membres.find((m) => m.id === "m-alice")!;
  return {
    groupe: v.groupe, moi: alice,
    cycles: [{ id: "c-sep", round: 1, number: 1, label: "Septembre 2026", due_date: null, amount_expected: 5000, status: "clos",
      opened_at: "2026-09-01T08:00:00Z", closed_at: "2026-09-30T20:00:00Z" }, { ...v.cycles[0], number: 2 }],
    paiements: [],
    dettes: [{ id: "d-alice", membership_id: "m-alice", cycle_id: "c-sep", amount: 5000, settled_at: null }],
    remises: [{ id: "r1", cycle_id: "c-sep", round: 1, membership_id: "m-bob", amount_expected: 20000, amount: 20000, status: "remis", paid_on: "2026-09-30" },
              { id: "r2", cycle_id: "c-oct", round: 1, membership_id: "m-tina", amount_expected: 20000, amount: null, status: "prevu", paid_on: null }],
    ordre: [
      { membership_id: "m-bob", display_name: "Bob", role: "membre", status: "actif", position: 1, is_me: false, servi: true, prevu: false },
      { membership_id: "m-tina", display_name: "Tina", role: "tresorier", status: "actif", position: 2, is_me: false, servi: false, prevu: true },
      { membership_id: "m-ines", display_name: "Ines", role: "membre", status: "invite", position: 3, is_me: false, servi: false, prevu: false },
      { membership_id: "m-alice", display_name: "Alice", role: "membre", status: "actif", position: 4, is_me: true, servi: false, prevu: false },
    ],
    recouvrement: [{ cycle_id: "c-oct", membres: 4, attendu: 20000, payes: 1, collecte: 5000 }],
  };
}
