import {
  comptes, cycleDe, exigerTresorier, groupeDe, horodatage, journaliser, parRang, refus, type Ctx, type EtatDemo,
} from "./etat";

/** Les k membres suivants dans l'ordre, sans remise dans le tour du cycle, deviennent bénéficiaires prévus. */
export function designerBeneficiaires(e: EtatDemo, c: Ctx, cycleId: string): number {
  const cy = cycleDe(e, cycleId);
  const g = groupeDe(e, cy.group_id);
  if (g.type !== "tontine") return 0;
  const membres = comptes(e, g.id);
  const part = Math.floor((cy.amount_expected * membres.length) / g.beneficiaries_per_cycle);
  const choisis = membres.filter((m) => !e.remises.some((r) => r.membership_id === m.id && r.round === cy.round))
    .sort(parRang).slice(0, g.beneficiaries_per_cycle);
  for (const m of choisis)
    e.remises.push({ id: c.id(), group_id: g.id, cycle_id: cy.id, round: cy.round, membership_id: m.id, amount_expected: part,
      amount: null, status: "prevu", paid_on: null, method: null, reference: null });
  return choisis.length;
}

export function ouvrirCycle(e: EtatDemo, c: Ctx, groupId: string, libelle: string, echeance: string | null): string {
  exigerTresorier(e, groupId, c);
  if (!libelle.trim()) refus("Libellé du cycle obligatoire");
  const g = groupeDe(e, groupId);
  if (e.cycles.some((x) => x.group_id === groupId && x.status === "ouvert")) refus("Un cycle est déjà ouvert : clôturez-le d'abord");
  if (!comptes(e, groupId).length) refus("Aucun membre dans le groupe");
  const number = Math.max(0, ...e.cycles.filter((x) => x.group_id === groupId && x.round === g.current_round).map((x) => x.number)) + 1;
  const id = c.id();
  e.cycles.push({ id, group_id: groupId, round: g.current_round, number, label: libelle.trim(), due_date: echeance,
    amount_expected: g.amount, status: "ouvert", opened_at: horodatage(c), closed_at: null });
  if (g.type === "tontine") {
    g.order_locked = true;
    if (designerBeneficiaires(e, c, id) === 0) refus("Tour terminé : tous les membres ont reçu leur part. Démarrez un nouveau tour.");
  }
  journaliser(e, c, groupId, "cycle_ouvert", { cycle: libelle.trim() }, true);
  return id;
}

export function cloreCycle(e: EtatDemo, c: Ctx, cycleId: string): { dettes: number; montant: number } {
  const cy = cycleDe(e, cycleId);
  exigerTresorier(e, cy.group_id, c);
  if (cy.status !== "ouvert") refus("Ce cycle est déjà clos");
  const attente = e.paiements.filter((p) => p.cycle_id === cy.id && p.debt_id === null && p.status === "declare").length;
  if (attente > 0) refus(`${attente} paiement(s) à valider ou contester avant de clore`);
  let n = 0;
  for (const m of comptes(e, cy.group_id).filter((x) => x.created_at <= cy.opened_at)) {
    const paye = e.paiements.filter((p) => p.cycle_id === cy.id && p.membership_id === m.id && p.debt_id === null && p.status === "valide")
      .reduce((s, p) => s + p.amount, 0);
    if (paye < cy.amount_expected) {
      e.dettes.push({ id: c.id(), group_id: cy.group_id, membership_id: m.id, cycle_id: cy.id, amount: cy.amount_expected - paye, settled_at: null });
      n++;
    }
  }
  const montant = e.dettes.filter((d) => d.cycle_id === cy.id).reduce((s, d) => s + d.amount, 0);
  cy.status = "clos"; cy.closed_at = horodatage(c);
  journaliser(e, c, cy.group_id, "cycle_clos", { cycle: cy.label, dettes: n }, true);
  return { dettes: n, montant };
}

export function rouvrirCycle(e: EtatDemo, c: Ctx, cycleId: string) {
  const cy = cycleDe(e, cycleId);
  exigerTresorier(e, cy.group_id, c);
  if (cy.status !== "clos") refus("Ce cycle n'est pas clos");
  if (e.cycles.some((x) => x.group_id === cy.group_id && x.status === "ouvert")) refus("Un autre cycle est ouvert");
  if (e.cycles.some((x) => x.group_id === cy.group_id && (x.round > cy.round || (x.round === cy.round && x.number > cy.number))))
    refus("Seul le dernier cycle peut être rouvert");
  if (e.dettes.some((d) => d.cycle_id === cy.id
      && (d.settled_at || e.paiements.some((p) => p.debt_id === d.id && p.status !== "conteste"))))
    refus("Des dettes de ce cycle ont déjà des règlements");
  e.dettes = e.dettes.filter((d) => d.cycle_id !== cy.id);
  cy.status = "ouvert"; cy.closed_at = null;
  journaliser(e, c, cy.group_id, "cycle_rouvert", { cycle: cy.label });
}
