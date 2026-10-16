/** « 5 000 FCFA » avec une espace ordinaire (toLocaleString met une espace fine insécable, gênante à l'export et en test). */
export const fcfa = (n: number) => `${n.toLocaleString("fr-FR").replace(/[  ]/g, " ")} FCFA`;

/** « 2026-10-30 » ou un horodatage → « 30/10/2026 ». */
export const dateCourte = (iso: string) => {
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
};

/** « de Bob », « d'Alice » : élision devant une voyelle ou un h. */
export const de = (nom: string) => (/^[aeiouyhàâäéèêëîïôöûüù]/i.test(nom) ? `d'${nom}` : `de ${nom}`);
