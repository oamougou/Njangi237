import type { InputHTMLAttributes } from "react";

export function Champ({ label, aide, ...p }: { label: string; aide?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="champ">
      <span>{label}</span>
      <input {...p} />
      {aide && <small>{aide}</small>}
    </label>
  );
}

/** Saisie d'un PIN : 6 chiffres, clavier numérique, rien d'autre n'est accepté. */
export function ChampPin({ label, valeur, onChange, autoFocus }: { label: string; valeur: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return <Champ label={label} value={valeur} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    inputMode="numeric" autoComplete="off" type="password" placeholder="••••••" className="pin" autoFocus={autoFocus} />;
}
