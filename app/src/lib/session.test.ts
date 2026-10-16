import { describe, expect, it, vi } from "vitest";
import { chargerMoi, oublierMoi } from "./session";
import { stockageMemoire } from "./horsLigne";
import { ErreurReseau } from "./erreurs";
import { fauxApi } from "../test/fauxApi";

const ALICE = { id: "u-alice", phone: "237690000003", full_name: "Alice", admin: false };

describe("chargerMoi", () => {
  it("en ligne : la personne est renvoyée et gardée sur le téléphone", async () => {
    const s = stockageMemoire(); const api = fauxApi(); api.session.mockResolvedValue(ALICE);
    expect(await chargerMoi(api, s)).toEqual(ALICE);
    api.session.mockRejectedValue(new ErreurReseau());
    expect(await chargerMoi(api, s)).toEqual(ALICE);
  });
  it("sans réseau et sans personne gardée : pas connecté", async () => {
    const api = fauxApi(); api.session.mockRejectedValue(new ErreurReseau());
    expect(await chargerMoi(api, stockageMemoire())).toBeNull();
  });
  it("déconnecté (pas de session) : la personne gardée est oubliée", async () => {
    const s = stockageMemoire(); const api = fauxApi(); api.session.mockResolvedValue(ALICE);
    await chargerMoi(api, s);
    api.session.mockResolvedValue(null);
    expect(await chargerMoi(api, s)).toBeNull();
    api.session.mockRejectedValue(new ErreurReseau());
    expect(await chargerMoi(api, s)).toBeNull();
  });
  it("une vraie erreur n'est pas confondue avec une coupure", async () => {
    const s = stockageMemoire(); const api = fauxApi(); api.session.mockResolvedValue(ALICE);
    await chargerMoi(api, s);
    oublierMoi(s);
    api.session.mockRejectedValue(new Error("boom"));
    expect(await chargerMoi(api, s)).toBeNull();
  });
});
