// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { demarrerEnvoi } from "./envoi";
import { lireFile, mettreEnFile, stockageMemoire } from "./horsLigne";
import { fauxApi } from "../test/fauxApi";
import { ErreurReseau } from "./erreurs";

const d = (id: string) => ({ id, groupId: "g1", cycleId: "c1", montant: 5000, moyen: "especes" as const, reference: null, date: "2026-10-16", detteId: null });
afterEach(() => { vi.useRealTimers(); });

describe("demarrerEnvoi", () => {
  it("vide la file de la personne au démarrage puis au retour du réseau, et prévient les écrans", async () => {
    const s = stockageMemoire(); const api = fauxApi();
    mettreEnFile(s, "u1", d("a"));
    const prevenu = vi.fn(); window.addEventListener("njangi:file", prevenu);
    const arreter = demarrerEnvoi(api, s, "u1");
    await vi.waitFor(() => expect(api.declarerPaiement).toHaveBeenCalledTimes(1));
    expect(lireFile(s, "u1")).toEqual([]);
    await vi.waitFor(() => expect(prevenu).toHaveBeenCalled());
    mettreEnFile(s, "u1", d("b"));
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(api.declarerPaiement).toHaveBeenCalledTimes(2));
    arreter();
    window.removeEventListener("njangi:file", prevenu);
  });

  it("n'envoie jamais la file d'une autre personne (téléphone partagé)", async () => {
    const s = stockageMemoire(); const api = fauxApi();
    mettreEnFile(s, "u-alice", d("a"));
    const arreter = demarrerEnvoi(api, s, "u-bob");
    await new Promise((r) => setTimeout(r, 20));
    expect(api.declarerPaiement).not.toHaveBeenCalled();
    expect(lireFile(s, "u-alice")).toHaveLength(1);
    arreter();
  });

  it("réseau faible sans événement « online » : nouvel essai toutes les 30 s tant que la file n'est pas vide", async () => {
    vi.useFakeTimers();
    const s = stockageMemoire(); const api = fauxApi();
    api.declarerPaiement.mockRejectedValueOnce(new ErreurReseau());
    mettreEnFile(s, "u1", d("a"));
    const arreter = demarrerEnvoi(api, s, "u1");
    await vi.advanceTimersByTimeAsync(0);
    expect(api.declarerPaiement).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.declarerPaiement).toHaveBeenCalledTimes(2);
    expect(lireFile(s, "u1")).toEqual([]);
    arreter();
  });
});
