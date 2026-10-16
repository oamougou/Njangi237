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

/** Une file par personne : sur un téléphone partagé, la déclaration d'Alice n'est jamais envoyée sous la session de Bob. */
const cleFile = (personId: string) => `njangi.file.${personId}`;

export function lireFile(s: Stockage, personId: string): EnFile[] {
  try { return JSON.parse(s.lire(cleFile(personId)) ?? "[]") as EnFile[]; } catch { return []; }
}
const ecrireFile = (s: Stockage, personId: string, f: EnFile[]) => s.ecrire(cleFile(personId), JSON.stringify(f));

export function mettreEnFile(s: Stockage, personId: string, d: Declaration) {
  const f = lireFile(s, personId);
  if (!f.some((e) => e.declaration.id === d.id)) ecrireFile(s, personId, [...f, { declaration: d, etat: "attente" }]);
}
export function retirerDeFile(s: Stockage, personId: string, id: string) {
  ecrireFile(s, personId, lireFile(s, personId).filter((e) => e.declaration.id !== id));
}

type Resultat = { envoyes: number; rejetes: number; coupure: boolean };
const envoisEnCours = new Map<string, Promise<Resultat>>();

/**
 * Envoie les déclarations en attente de cette personne, dans l'ordre. Une coupure arrête l'envoi (on réessaiera) ;
 * un refus de la base marque la déclaration « rejete » avec son motif (plus jamais renvoyée). Un seul vidage à la fois.
 */
export function viderFile(s: Stockage, personId: string, envoyer: (d: Declaration) => Promise<unknown>): Promise<Resultat> {
  const enCours = envoisEnCours.get(personId);
  if (enCours) return enCours;
  const p = (async () => {
    let envoyes = 0, rejetes = 0, coupure = false;
    for (const e of lireFile(s, personId).filter((x) => x.etat === "attente")) {
      try {
        await envoyer(e.declaration);
        retirerDeFile(s, personId, e.declaration.id);
        envoyes++;
      } catch (err) {
        if (estReseau(err)) { coupure = true; break; }
        ecrireFile(s, personId, lireFile(s, personId).map((x) => x.declaration.id === e.declaration.id
          ? { ...x, etat: "rejete" as const, erreur: (err as Error).message } : x));
        rejetes++;
      }
    }
    return { envoyes, rejetes, coupure };
  })().finally(() => { envoisEnCours.delete(personId); });
  envoisEnCours.set(personId, p);
  return p;
}
