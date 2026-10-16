import { normaliserTelephone } from "./telephone";

/** Contact tel que le renvoie le sélecteur du navigateur (Contact Picker API). */
export interface ContactBrut { name?: string[]; tel?: string[] }
export interface Candidat { nom: string; telephone: string }
export interface Tri { candidats: Candidat[]; ignores: { nom: string; raison: string }[] }

const normaliser = (t: string) => { try { return normaliserTelephone(t); } catch { return null; } };

/** Retient les contacts ajoutables : un nom, un numéro camerounais valide, absent du groupe et de la sélection. */
export function trierContacts(contacts: ContactBrut[], numerosDuGroupe: string[]): Tri {
  const vus = new Set(numerosDuGroupe);
  const tri: Tri = { candidats: [], ignores: [] };
  for (const c of contacts) {
    const nom = (c.name ?? []).map((n) => n.trim()).find(Boolean) ?? "";
    const telephone = (c.tel ?? []).map(normaliser).find((t): t is string => t !== null) ?? null;
    if (!nom) { tri.ignores.push({ nom: c.tel?.[0] ?? "Contact", raison: "sans nom" }); continue; }
    if (!telephone) { tri.ignores.push({ nom, raison: "numéro invalide" }); continue; }
    if (vus.has(telephone)) {
      tri.ignores.push({ nom, raison: numerosDuGroupe.includes(telephone) ? "déjà dans le groupe" : "en double dans la sélection" });
      continue;
    }
    vus.add(telephone);
    tri.candidats.push({ nom, telephone });
  }
  return tri;
}

type Selecteur = { select(props: string[], opts: { multiple: boolean }): Promise<ContactBrut[]> };

/** Le sélecteur de contacts n'existe que sur Chrome pour Android, en https. */
export const contactsDisponibles = () =>
  typeof navigator !== "undefined" && "contacts" in navigator && typeof window !== "undefined" && "ContactsManager" in window;

/** Ouvre le carnet d'adresses ; une annulation renvoie une liste vide. */
export async function choisirContacts(): Promise<ContactBrut[]> {
  try { return await (navigator as unknown as { contacts: Selecteur }).contacts.select(["name", "tel"], { multiple: true }); }
  catch { return []; }
}
