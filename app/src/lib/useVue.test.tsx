// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useVue } from "./useVue";
import { memoriser, stockageMemoire, type Stockage } from "./horsLigne";
import { ErreurReseau } from "./erreurs";

afterEach(cleanup);

function Sonde(p: { cle: string | null; charger: () => Promise<{ n: number }>; abonner: (cb: () => void) => () => void; stockage: Stockage }) {
  const v = useVue(p);
  return <p>{v.vue ? `n=${v.vue.n}` : "vide"}{v.horsLigne ? ` hors-ligne ${v.le}` : ""}{v.err ? ` err=${v.err}` : ""}</p>;
}
const sansAbonnement = () => () => {};

describe("useVue", () => {
  it("affiche tout de suite la mémoire, puis les données fraîches qu'il mémorise", async () => {
    const s = stockageMemoire();
    memoriser(s, "u1.g1", { n: 1 }, new Date("2026-10-16T10:00:00Z"));
    let rendre!: (v: { n: number }) => void;
    render(<Sonde cle="u1.g1" stockage={s} abonner={sansAbonnement} charger={() => new Promise((r) => { rendre = r; })} />);
    expect(screen.getByText("n=1")).toBeTruthy();
    await act(async () => rendre({ n: 2 }));
    expect(screen.getByText("n=2")).toBeTruthy();
    expect(JSON.parse(s.lire("njangi.vue.u1.g1")!).donnees).toEqual({ n: 2 });
  });

  it("sans réseau : garde la mémoire et signale « hors ligne » avec sa date", async () => {
    const s = stockageMemoire();
    memoriser(s, "u1.g1", { n: 1 }, new Date("2026-10-16T10:00:00Z"));
    render(<Sonde cle="u1.g1" stockage={s} abonner={sansAbonnement} charger={async () => { throw new ErreurReseau(); }} />);
    expect(await screen.findByText(/n=1 hors-ligne 2026-10-16T10:00:00.000Z/)).toBeTruthy();
  });

  it("clé par personne : la mémoire d'une autre personne n'est jamais montrée", async () => {
    const s = stockageMemoire();
    memoriser(s, "u1.g1", { n: 1 });
    render(<Sonde cle="u2.g1" stockage={s} abonner={sansAbonnement} charger={async () => { throw new ErreurReseau(); }} />);
    expect(await screen.findByText(/vide hors-ligne/)).toBeTruthy();
  });

  it("refus de la base : message d'erreur, pas « hors ligne »", async () => {
    render(<Sonde cle="u1.g1" stockage={stockageMemoire()} abonner={sansAbonnement} charger={async () => { throw new Error("Groupe introuvable"); }} />);
    expect(await screen.findByText(/err=Groupe introuvable/)).toBeTruthy();
  });

  it("temps réel : une rafale de changements = un seul rechargement ; désabonnement en quittant", async () => {
    vi.useFakeTimers();
    let signal!: () => void; const arret = vi.fn();
    const charger = vi.fn(async () => ({ n: 1 }));
    const { unmount } = render(<Sonde cle="u1.g1" stockage={stockageMemoire()} charger={charger}
      abonner={(cb) => { signal = cb; return arret; }} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(charger).toHaveBeenCalledTimes(1);
    act(() => { signal(); signal(); signal(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(charger).toHaveBeenCalledTimes(2);
    unmount();
    expect(arret).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
