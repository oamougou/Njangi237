import { createSupabaseApi } from "./supabaseApi";
import type { Api } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null tant que l'application n'est pas configurée (le mode démo arrive au lot 6). */
export const api: Api | null = url && key ? createSupabaseApi(url, key) : null;
