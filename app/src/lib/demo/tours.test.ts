import { describe, expect, it } from "vitest";
import { monde } from "../../test/demo";
import { cloreCycle, ouvrirCycle } from "./cycles";
import { echangerTours, enregistrerRemise, nouveauTour, ordonnerTours, remplacerBeneficiaire, tirerAuSort } from "./tours";

const VERROU = "L'ordre est verrouillé : utilisez l'échange de tours";

describe("moteur démo : tours", () => {
  it("règle l'ordre avant le premier cycle, puis le verrouille", () => {
    const w = monde();
    expect(() => ordonnerTours(w.e, w.tina, w.groupId, [w.m.bob, w.m.alice])).toThrow("La liste doit contenir chaque membre une seule fois");
    ordonnerTours(w.e, w.tina, w.groupId, [w.m.bob, w.m.ines, w.m.alice, w.m.tina]);
    expect(w.e.journal.at(-1)).toMatchObject({ action: "ordre_modifie", visible: true, details: { ordre: ["Bob", "Ines", "Alice", "Tina"] } });
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    expect(w.e.remises[0].membership_id).toBe(w.m.bob);
    expect(() => ordonnerTours(w.e, w.tina, w.groupId, [w.m.tina, w.m.alice, w.m.bob, w.m.ines])).toThrow(VERROU);
    expect(() => tirerAuSort(w.e, w.tina, w.groupId)).toThrow(VERROU);
  });
  it("le tirage au sort donne chaque position une fois et renvoie les noms dans l'ordre", () => {
    const w = monde();
    const noms = tirerAuSort(w.e, w.tina, w.groupId);
    expect([...noms].sort()).toEqual(["Alice", "Bob", "Ines", "Tina"]);
    expect(w.e.membres.map((m) => m.position).sort()).toEqual([1, 2, 3, 4]);
    expect(w.e.journal.at(-1)).toMatchObject({ action: "tirage_au_sort", details: { ordre: noms } });
  });
  it("l'échange déplace aussi la remise prévue ; impossible avec un membre déjà servi", () => {
    const w = monde();
    const c = ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    echangerTours(w.e, w.tina, w.m.tina, w.m.bob);
    expect(w.e.remises[0].membership_id).toBe(w.m.bob);
    expect(w.e.membres.find((m) => m.id === w.m.bob)?.position).toBe(1);
    enregistrerRemise(w.e, w.tina, w.e.remises[0].id, 20000, "especes", null);
    expect(() => echangerTours(w.e, w.tina, w.m.bob, w.m.alice)).toThrow("Un de ces membres a déjà reçu sa part dans ce tour");
    expect(() => remplacerBeneficiaire(w.e, w.tina, w.e.remises[0].id, w.m.alice)).toThrow("Cette cagnotte est déjà remise");
    cloreCycle(w.e, w.tina, c);
  });
  it("la remise donne l'écart avec le montant attendu et exige la référence MoMo", () => {
    const w = monde();
    ouvrirCycle(w.e, w.tina, w.groupId, "Septembre", null);
    const r = w.e.remises[0].id;
    expect(() => enregistrerRemise(w.e, w.tina, r, 18000, "orange_money", null))
      .toThrow("Référence de transaction obligatoire pour MoMo et Orange Money");
    expect(enregistrerRemise(w.e, w.tina, r, 18000, "orange_money", "OM7")).toEqual({ ecart: -2000 });
    expect(w.e.journal.at(-1)).toMatchObject({ action: "cagnotte_remise", visible: true, details: { nom: "Tina", montant: 18000 } });
  });
  it("un nouveau tour attend que tous soient servis ; un cinquième cycle est refusé", () => {
    const w = monde();
    for (let i = 0; i < 4; i++) {
      const c = ouvrirCycle(w.e, w.tina, w.groupId, `Cycle ${i + 1}`, null);
      if (i === 0) expect(() => nouveauTour(w.e, w.tina, w.groupId)).toThrow("Clôturez d'abord le cycle en cours");
      enregistrerRemise(w.e, w.tina, w.e.remises.at(-1)!.id, 20000, "especes", null);
      cloreCycle(w.e, w.tina, c);
      if (i === 2) expect(() => nouveauTour(w.e, w.tina, w.groupId))
        .toThrow("Le tour n'est pas terminé : tous les membres n'ont pas reçu leur part");
    }
    // Le moteur modifie l'état avant de refuser (demoApi n'enregistre pas l'échec) : on essaie sur une copie
    expect(() => ouvrirCycle(structuredClone(w.e), w.tina, w.groupId, "Cycle 5", null))
      .toThrow("Tour terminé : tous les membres ont reçu leur part. Démarrez un nouveau tour.");
    expect(nouveauTour(w.e, w.tina, w.groupId)).toBe(2);
    expect(w.e.groupes[0]).toMatchObject({ current_round: 2, order_locked: false });
  });
  it("les tours sont réservés aux tontines", () => {
    const w = monde();
    w.e.groupes[0].type = "cotisation";
    expect(() => tirerAuSort(w.e, w.tina, w.groupId)).toThrow("Réservé aux tontines");
  });
});
