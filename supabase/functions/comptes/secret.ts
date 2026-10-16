// Le mot de passe Supabase Auth n'est jamais le PIN : il en est dérivé avec une clé connue du seul serveur.
// Sans cette clé, essayer les 10^6 PIN directement contre Supabase Auth ne mène nulle part ;
// le seul chemin reste la fonction comptes, avec son blocage après 5 essais.

const base64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** HMAC-SHA256(poivre, « téléphone:PIN ») en base64url (43 caractères). */
export async function motDePasse(poivre: string, phone: string, pin: string): Promise<string> {
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(poivre), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(`${phone}:${pin}`))));
}
