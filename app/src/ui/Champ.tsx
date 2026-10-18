import type { InputHTMLAttributes } from "react";

export function Champ({ label, aide, ...p }: { label: string; aide?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <label className="champ">
        <span>{label}</span>
        <input {...p} />
      </label>
      {/* Hors de l'étiquette : sinon l'aide s'ajouterait au nom accessible du champ */}
      {aide && <small className="aide">{aide}</small>}
    </>
  );
}

/**
 * Saisie d'un PIN : 6 chiffres, clavier numérique, rien d'autre n'est accepté.
 * Champ texte masqué par CSS et non « password » : sur iPhone, Safari remplit d'office un « mot de passe fort »
 * (lettres et chiffres) dans un formulaire nom + deux mots de passe ; il n'en restait que quelques chiffres et le bouton
 * restait grisé sans explication. Le compteur dit combien de chiffres manquent.
 */
export function ChampPin({ label, valeur, onChange, autoFocus }: { label: string; valeur: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return <Champ label={label} value={valeur} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    inputMode="numeric" pattern="[0-9]*" autoComplete="off" autoCorrect="off" spellCheck={false} type="text"
    placeholder="••••••" className="pin" autoFocus={autoFocus} aide={`${valeur.length} / 6 chiffres`} />;
}
