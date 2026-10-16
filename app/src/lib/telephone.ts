// Une seule règle de numéro pour la base, la fonction serveur et l'application.
export { normaliserTelephone } from "../../../supabase/functions/comptes/telephone.ts";

/** 237690000007 → « 6 90 00 00 07 » ; tout autre format est rendu tel quel. */
export const afficherTelephone = (p: string) => p.replace(/^237(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5");
