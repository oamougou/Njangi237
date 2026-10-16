import { estReseau } from "./erreurs";
import type { Declaration } from "./types";

/** Petite mémoire clé/valeur : localStorage sur le téléphone, une Map dans les tests. */
export interface Stockage { lire(cle: string): string | null; ecrire(cle: string, v: string): void; supprimer(cle: string): void }

export function stockageMemoire(): Stockage {
  const m = new Map<string, string>();
  return { lire: (k) => m.get(k) ?? null, ecrire: (k, v) => { m.set(k, v); }, supprimer: (k) => { m.delete(k); } };
}
export function stockageNavigateur(): Stockage {
  return {
    lire: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    ecrire: (k, v) => { try { localStorage.setItem(k, v); } catch { /* mémoire pleine ou désactivée : on continue sans */ } },
    supprimer: (k) => { try { localStorage.removeItem(k); } catch { /* idem */ } },
  };
}

export interface Memo<T> { donnees: T; le: string }

/** `cle` doit inclure l'identifiant de la personne connectée (téléphone partagé). */
export function memoriser<T>(s: Stockage, cle: string, donnees: T, maintenant = new Date()) {
  s.ecrire(`njangi.vue.${cle}`, JSON.stringify({ donnees, le: maintenant.toISOString() }));
}
export function relire<T>(s: Stockage, cle: string): Memo<T> | null {
  const brut = s.lire(`njangi.vue.${cle}`);
  if (!brut) return null;
  try { return JSON.parse(brut) as Memo<T>; } catch { return null; }
}

export interface EnFile { declaration: Declaration; etat: "attente" | "rejete"; erreur?: string }
const CLE_FILE = "njangi.file";

export function lireFile(s: Stockage): EnFile[] {
  try { return JSON.parse(s.lire(CLE_FILE) ?? "[]") as EnFile[]; } catch { return []; }
}
const ecrireFile = (s: Stockage, f: EnFile[]) => s.ecrire(CLE_FILE, JSON.stringify(f));

export function mettreEnFile(s: Stockage, d: Declaration) {
  const f = lireFile(s);
  if (!f.some((e) => e.declaration.id === d.id)) ecrireFile(s, [...f, { declaration: d, etat: "attente" }]);
}
export function retirerDeFile(s: Stockage, id: string) {
  ecrireFile(s, lireFile(s).filter((e) => e.declaration.id !== id));
}

let envoiEnCours: Promise<{ envoyes: number; rejetes: number; coupure: boolean }> | null = null;

/**
 * Envoie les déclarations en attente, dans l'ordre. Une coupure arrête l'envoi (on réessaiera) ; un refus de la base
 * marque la déclaration « rejete » avec son motif (elle ne sera plus renvoyée). Un seul vidage à la fois.
 */
export function viderFile(s: Stockage, envoyer: (d: Declaration) => Promise<unknown>) {
  if (envoiEnCours) return envoiEnCours;
  envoiEnCours = (async () => {
    let envoyes = 0, rejetes = 0, coupure = false;
    for (const e of lireFile(s).filter((x) => x.etat === "attente")) {
      try {
        await envoyer(e.declaration);
        retirerDeFile(s, e.declaration.id);
        envoyes++;
      } catch (err) {
        if (estReseau(err)) { coupure = true; break; }
        ecrireFile(s, lireFile(s).map((x) => x.declaration.id === e.declaration.id
          ? { ...x, etat: "rejete" as const, erreur: (err as Error).message } : x));
        rejetes++;
      }
    }
    return { envoyes, rejetes, coupure };
  })().finally(() => { envoiEnCours = null; });
  return envoiEnCours;
}
