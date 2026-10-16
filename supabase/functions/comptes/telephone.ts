// Partagé avec l'application (app/src/lib/telephone.ts) : même règle que normaliser_telephone (SQL).

/** Numéro camerounais : chiffres seuls, préfixe 00 retiré, 237 ajouté devant 9 chiffres. */
export function normaliserTelephone(s: string): string {
  let d = String(s ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "237" + d;
  if (!/^237\d{9}$/.test(d)) throw new Error("Numéro de téléphone invalide");
  return d;
}

/** Identifiant Supabase Auth construit à partir du numéro (le membre ne le voit jamais). */
export const emailInterne = (phone: string) => `${phone}@njangi237.local`;

export const pinValide = (x: unknown): x is string => typeof x === "string" && /^\d{6}$/.test(x);
