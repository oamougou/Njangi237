// Partagé avec l'application : le jeton est tiré sur le téléphone du trésorier, seule son empreinte est stockée.

/** 32 octets aléatoires en base64url sans remplissage (43 caractères). */
export function genererJeton(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const jetonValide = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{43}$/.test(x);

/** Empreinte SHA-256 en hexadécimal (64 caractères). */
export async function hashJeton(jeton: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("");
}
