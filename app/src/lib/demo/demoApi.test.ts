import { describe, expect, it, vi } from "vitest";
import { stockageMemoire, type Stockage } from "../horsLigne";
import { CLE_ETAT, createDemoApi, INDISPONIBLE, type CanalDemo } from "./demoApi";
import type { ProfilDemo } from "./modeDemo";

const options = (stockage: Stockage = stockageMemoire(), profil: ProfilDemo = "tina", canal: CanalDemo | null = null) => ({
  stockage, profil: () => profil, quitter: vi.fn(), base: () => "https://njangi237.pages.dev/", canal,
  maintenant: () => new Date("2026-10-17T10:00:00Z"), hasard: () => 0.3,
});
/** Deux onglets : ce que l'un publie, l'autre le reçoit. */
function deuxOnglets(): [CanalDemo, CanalDemo] {
  const ecoutes: (() => void)[][] = [[], []];
  const canal = (i: 0 | 1): CanalDemo => ({ postMessage: () => ecoutes[1 - i].forEach((f) => f()), addEventListener: (_t, f) => { ecoutes[i].push(f); } });
  return [canal(0), canal(1)];
}
const tontine = async (api: ReturnType<typeof createDemoApi>) => (await api.mesGroupes()).find((g) => g.groupe.name === "Tontine des amis")!.groupe.id;

describe("demoApi", () => {
  it("connecte Tina ou Alice selon le profil, sans administration", async () => {
    expect(await createDemoApi(options()).session()).toMatchObject({ full_name: "Tina Mbarga", admin: false });
    expect(await createDemoApi(options(stockageMemoire(), "alice")).session()).toMatchObject({ full_name: "Alice Ekane" });
  });
  it("garde l'état : une action d'Alice se voit chez Tina sur le même téléphone", async () => {
    const s = stockageMemoire();
    const alice = createDemoApi(options(s, "alice"));
    const g = await tontine(alice);
    const vue = await alice.chargerVueMembre(g);
    const cycle = vue.cycles.find((c) => c.status === "ouvert")!;
    await alice.declarerPaiement({ id: "p-demo", groupId: g, cycleId: cycle.id, montant: 10000, moyen: "mtn_momo", reference: "MP1", date: "2026-10-17", detteId: null });
    const tina = createDemoApi(options(s, "tina"));
    expect((await tina.chargerGroupe(g)).paiements.find((p) => p.id === "p-demo")?.status).toBe("declare");
    expect((await alice.chargerVueMembre(g)).paiements.every((p) => p.membership_id === vue.moi.id)).toBe(true);
  });
  it("une action refusée n'enregistre rien et garde le message de la base", async () => {
    const s = stockageMemoire();
    const api = createDemoApi(options(s));
    const g = await tontine(api);
    const avant = s.lire(CLE_ETAT);
    await expect(api.ouvrirCycle(g, "Encore un", null)).rejects.toThrow("Un cycle est déjà ouvert : clôturez-le d'abord");
    const ouvert = (await api.chargerGroupe(g)).cycles.find((c) => c.status === "ouvert")!;
    await expect(api.cloreCycle(ouvert.id)).rejects.toThrow("2 paiement(s) à valider ou contester avant de clore");
    expect(s.lire(CLE_ETAT)).toBe(avant);
  });
  it("repart des données de démonstration si l'état gardé est abîmé ou d'une autre version", async () => {
    for (const brut of ["{pas du json", JSON.stringify({ version: 0 })]) {
      const s = stockageMemoire(); s.ecrire(CLE_ETAT, brut);
      expect(await createDemoApi(options(s)).mesGroupes()).toHaveLength(2);
    }
  });
  it("prévient les écrans abonnés, dans cet onglet et dans un autre", async () => {
    const s = stockageMemoire();
    const [a, b] = deuxOnglets();
    const tina = createDemoApi(options(s, "tina", a));
    const alice = createDemoApi(options(s, "alice", b));
    const ici = vi.fn(), labas = vi.fn();
    const arreter = tina.abonner(["x"], ici);
    alice.abonner(["x"], labas);
    const g = await tontine(tina);
    const attente = (await tina.chargerGroupe(g)).paiements.find((p) => p.status === "declare")!;
    await tina.validerPaiement(attente.id);
    expect(ici).toHaveBeenCalledTimes(1);
    expect(labas).toHaveBeenCalledTimes(1);
    arreter();
    await tina.contesterPaiement(attente.id, "Erreur");
    expect(ici).toHaveBeenCalledTimes(1);
  });
  it("rend un lien d'invitation fictif, sans WhatsApp", async () => {
    const api = createDemoApi(options());
    const g = await tontine(api);
    const ines = (await api.chargerGroupe(g)).membres.find((m) => m.display_name === "Inès Moukouri")!;
    expect(await api.inviter(ines.id, "invitation")).toEqual({ lien: "https://njangi237.pages.dev/#/invitation/demo", whatsapp: "",
      expire: "2026-10-24T10:00:00.000Z", nom: "Inès Moukouri", demo: true });
  });
  it("refuse ce qui demande un vrai compte", async () => {
    const api = createDemoApi(options());
    // Appels lancés un par un : une promesse rejetée et pas encore attendue ferait échouer Vitest
    for (const appel of [() => api.connexion("690000001", "123456"), () => api.changerPin("123456", "654321"), () => api.apercu("j"),
      () => api.creerGroupe({ nom: "x", type: "tontine", montant: 1, frequence: "mensuelle", beneficiaires: 1, tresorier_nom: "x", tresorier_telephone: "690000001" })])
      await expect(appel()).rejects.toThrow(INDISPONIBLE);
  });
  it("réinitialise la démo et quitte par la fonction fournie", async () => {
    const o = options();
    const api = createDemoApi(o);
    const g = await tontine(api);
    await api.ajouterMembre(g, "Zoé", "690000099");
    api.reinitialiser();
    expect((await api.chargerGroupe(g)).membres).toHaveLength(12);
    await api.quitter();
    expect(o.quitter).toHaveBeenCalled();
  });
  it("abonnement en démo : offre Groupe, sans limite à payer, en lecture seule", async () => {
    const api = createDemoApi(options());
    const g = await tontine(api);
    expect(await api.etatAbonnement(g)).toMatchObject({ offre: "groupe", limite: 50, membres: 12, demo: true });
    await expect(api.demanderAbonnement({ groupId: g, offre: "groupe", dureeMois: 1, moyen: "mtn_momo", reference: "x", precisions: null }))
      .rejects.toThrow(INDISPONIBLE);
  });
});
