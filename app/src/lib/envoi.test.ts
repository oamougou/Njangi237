// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { demarrerEnvoi } from "./envoi";
import { lireFile, mettreEnFile, stockageMemoire } from "./horsLigne";
import { fauxApi } from "../test/fauxApi";

describe("demarrerEnvoi", () => {
  it("vide la file au démarrage puis au retour du réseau, et prévient les écrans", async () => {
    const s = stockageMemoire(); const api = fauxApi();
    mettreEnFile(s, { id: "a", groupId: "g1", cycleId: "c1", montant: 5000, moyen: "especes", reference: null, date: "2026-10-16", detteId: null });
    const prevenu = vi.fn(); window.addEventListener("njangi:file", prevenu);
    const arreter = demarrerEnvoi(api, s);
    await vi.waitFor(() => expect(api.declarerPaiement).toHaveBeenCalledTimes(1));
    expect(lireFile(s)).toEqual([]);
    await vi.waitFor(() => expect(prevenu).toHaveBeenCalled());
    mettreEnFile(s, { id: "b", groupId: "g1", cycleId: "c1", montant: 5000, moyen: "especes", reference: null, date: "2026-10-16", detteId: null });
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(api.declarerPaiement).toHaveBeenCalledTimes(2));
    arreter();
    window.removeEventListener("njangi:file", prevenu);
  });
});
