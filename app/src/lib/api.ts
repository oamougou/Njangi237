import { createDemoApi, type DemoApi } from "./demo/demoApi";
import { estModeDemo, profilDemo, quitterDemo } from "./demo/modeDemo";
import { stockageNavigateur } from "./horsLigne";
import { createSupabaseApi } from "./supabaseApi";
import type { Api } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Application branchée sur Supabase ; sans configuration, seule la démo est possible. */
export const configuree = Boolean(url && key);
export const modeDemo = !configuree || estModeDemo();
/** Vues gardées et file hors ligne de la démo rangées à part : jamais mêlées à celles d'un vrai compte sur le même téléphone. */
export const stockage = stockageNavigateur(modeDemo ? "njangi.demo:" : "");
export const demo: DemoApi | null = modeDemo
  ? createDemoApi({
      stockage, profil: profilDemo, quitter: () => quitterDemo(), base: () => `${location.origin}${location.pathname}`,
      canal: typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("njangi-demo") : null,
    })
  : null;
export const api: Api = demo ?? createSupabaseApi(url!, key!);
