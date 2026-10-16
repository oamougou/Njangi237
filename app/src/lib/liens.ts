export type TypeLien = "invitation" | "reinitialisation";

/** Le jeton est placé après « # » : il n'est jamais envoyé au serveur d'hébergement. */
export const lienApp = (base: string, type: TypeLien, jeton: string) =>
  `${base}#/${type === "invitation" ? "invitation" : "nouveau-pin"}/${jeton}`;

export function messageWhatsApp(type: TypeLien, groupe: string, nom: string, lien: string): string {
  return type === "invitation"
    ? `Bonjour ${nom}, vous êtes invité(e) à rejoindre « ${groupe} » sur Njangi237. Ouvrez ce lien et choisissez votre code PIN (valable 7 jours) : ${lien}`
    : `Bonjour ${nom}, voici votre lien pour choisir un nouveau PIN Njangi237 (« ${groupe} », valable 24 h) : ${lien}`;
}

export const lienWhatsApp = (phone: string, message: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
