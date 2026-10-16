import type { Frequence } from "./types";

const jj = (n: number) => String(n).padStart(2, "0");
const dateFr = (d: Date) => `${jj(d.getDate())}/${jj(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Libellé proposé à l'ouverture d'un cycle. */
export function libelleParDefaut(d: Date, frequence: Frequence): string {
  if (frequence === "mensuelle") {
    const m = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  return `${frequence === "hebdomadaire" ? "Semaine du" : "Cycle du"} ${dateFr(d)}`;
}
