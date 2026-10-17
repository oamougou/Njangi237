// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changerProfil, entrerDemo, estModeDemo, profilDemo, quitterDemo } from "./modeDemo";

describe("mode démo", () => {
  beforeEach(() => sessionStorage.clear());
  it("entre en démo avec Tina, passe en Alice, puis quitte", () => {
    const recharger = vi.fn();
    expect(estModeDemo()).toBe(false);
    entrerDemo(recharger);
    expect([estModeDemo(), profilDemo()]).toEqual([true, "tina"]);
    changerProfil(recharger);
    expect(profilDemo()).toBe("alice");
    quitterDemo(recharger);
    expect(estModeDemo()).toBe(false);
    expect(recharger).toHaveBeenCalledTimes(3);
  });
});
