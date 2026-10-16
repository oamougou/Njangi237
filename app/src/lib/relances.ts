import { dateCourte, fcfa } from "./format";

export function messageRelance(nom: string, groupe: string, montant: number, echeance: string | null): string {
  return `Bonjour ${nom}, petit rappel pour votre cotisation de ${fcfa(montant)} à « ${groupe} »` +
    (echeance ? `, à régler avant le ${dateCourte(echeance)}` : "") +
    ". Vous pouvez payer par MTN MoMo ou Orange Money, puis déclarer votre paiement dans Njangi237. Merci !";
}

/**
 * Relance « un par un » : la file est fixée au premier geste ; chaque geste prend le suivant encore en retard.
 * Les navigateurs n'ouvrent qu'une fenêtre par geste de l'utilisateur.
 */
export function prochaineRelance(file: string[] | null, enRetard: string[]): { suivant: string | null; file: string[] } {
  const restante = (file && file.length ? file : enRetard).filter((id) => enRetard.includes(id));
  return { suivant: restante[0] ?? null, file: restante.slice(1) };
}
