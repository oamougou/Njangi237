import { describe, expect, it, vi } from "vitest";
import { ErreurReseau } from "./erreurs";
import { lireFile, memoriser, mettreEnFile, relire, retirerDeFile, stockageMemoire, viderFile } from "./horsLigne";
import type { Declaration } from "./types";

const d = (id: string): Declaration => ({ id, groupId: "g1", cycleId: "c1", montant: 5000, moyen: "mtn_momo",
  reference: "MP1", date: "2026-10-16", detteId: null });

describe("mémoire des vues", () => {
  it("relit ce qui a été mémorisé, avec la date", () => {
    const s = stockageMemoire();
    memoriser(s, "u1.groupe.g1", { a: 1 }, new Date("2026-10-16T12:30:00Z"));
    expect(relire(s, "u1.groupe.g1")).toEqual({ donnees: { a: 1 }, le: "2026-10-16T12:30:00.000Z" });
    expect(relire(s, "u2.groupe.g1")).toBeNull();
  });
  it("une mémoire illisible est ignorée", () => {
    const s = stockageMemoire();
    s.ecrire("njangi.vue.x", "{pas du json");
    expect(relire(s, "x")).toBeNull();
  });
});

describe("file des déclarations", () => {
  it("mise en file sans doublon, retrait", () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a")); mettreEnFile(s, d("a")); mettreEnFile(s, d("b"));
    expect(lireFile(s).map((e) => e.declaration.id)).toEqual(["a", "b"]);
    retirerDeFile(s, "a");
    expect(lireFile(s).map((e) => e.declaration.id)).toEqual(["b"]);
  });

  it("vider : envoie dans l'ordre et retire ce qui est parti", async () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a")); mettreEnFile(s, d("b"));
    const envoyer = vi.fn(async () => {});
    expect(await viderFile(s, envoyer)).toEqual({ envoyes: 2, rejetes: 0, coupure: false });
    expect(envoyer.mock.calls.map((c) => c[0].id)).toEqual(["a", "b"]);
    expect(lireFile(s)).toEqual([]);
  });

  it("coupure réseau : on s'arrête et on garde la suite pour plus tard", async () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a")); mettreEnFile(s, d("b"));
    const envoyer = vi.fn(async () => { throw new ErreurReseau(); });
    expect(await viderFile(s, envoyer)).toEqual({ envoyes: 0, rejetes: 0, coupure: true });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(lireFile(s).map((e) => e.etat)).toEqual(["attente", "attente"]);
  });

  it("refus de la base : marqué refusé avec le motif, jamais renvoyé", async () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a")); mettreEnFile(s, d("b"));
    const envoyer = vi.fn(async (x: Declaration) => { if (x.id === "a") throw new Error("Ce cycle est clos"); });
    expect(await viderFile(s, envoyer)).toEqual({ envoyes: 1, rejetes: 1, coupure: false });
    expect(lireFile(s)).toEqual([{ declaration: d("a"), etat: "rejete", erreur: "Ce cycle est clos" }]);
    await viderFile(s, envoyer);
    expect(envoyer).toHaveBeenCalledTimes(2);
  });

  it("deux vidages simultanés n'envoient qu'une fois", async () => {
    const s = stockageMemoire();
    mettreEnFile(s, d("a"));
    let fini!: () => void;
    const envoyer = vi.fn(() => new Promise<void>((r) => { fini = r; }));
    const p1 = viderFile(s, envoyer); const p2 = viderFile(s, envoyer);
    fini(); await Promise.all([p1, p2]);
    expect(envoyer).toHaveBeenCalledTimes(1);
  });
});
