/** Teintes chaudes des avatars de groupe (lisibles avec des initiales blanches). */
const PALETTE = ["#2B9A66", "#E0892B", "#0F5C4E", "#C2553A", "#B7861F", "#3A7CA5"];

/** Couleur fixe pour un identifiant : le même groupe garde sa couleur partout et d'une fois sur l'autre. */
export function couleurAvatar(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "?";
  return mots.slice(0, 2).map((m) => m[0]!.toUpperCase()).join("");
}

export function prenom(nomComplet: string): string {
  const p = nomComplet.trim().split(/\s+/)[0] ?? "";
  return p ? p[0]!.toUpperCase() + p.slice(1) : "";
}

export function Avatar({ id, nom }: { id: string; nom: string }) {
  return <span className="avatar" aria-hidden="true" style={{ background: couleurAvatar(id) }}>{initiales(nom)}</span>;
}

export function Barre({ valeur, libelle }: { valeur: number; libelle: string }) {
  const v = Math.round(Math.min(100, Math.max(0, valeur)));
  return (
    <div className="barre" role="progressbar" aria-label={libelle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}
