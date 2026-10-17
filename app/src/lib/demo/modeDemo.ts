/** Mode démo propre à l'onglet (sessionStorage) ; l'état fictif, lui, est partagé entre onglets (localStorage). */
export type ProfilDemo = "tina" | "alice";

const DRAPEAU = "njangi.demo";
const PROFIL = "njangi.demo.profil";
const session = (): Storage | null => { try { return sessionStorage; } catch { return null; } };

export const rechargerPage = () => { location.hash = "#/"; location.reload(); };
export const estModeDemo = () => session()?.getItem(DRAPEAU) === "1";
export const profilDemo = (): ProfilDemo => (session()?.getItem(PROFIL) === "alice" ? "alice" : "tina");

export function entrerDemo(recharger = rechargerPage) {
  session()?.setItem(DRAPEAU, "1"); session()?.setItem(PROFIL, "tina"); recharger();
}
export function changerProfil(recharger = rechargerPage) {
  session()?.setItem(PROFIL, profilDemo() === "tina" ? "alice" : "tina"); recharger();
}
export function quitterDemo(recharger = rechargerPage) {
  session()?.removeItem(DRAPEAU); session()?.removeItem(PROFIL); recharger();
}
