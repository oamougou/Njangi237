/** Panneau de confirmation dans la page (pas de window.confirm : il bloque l'interface et se teste mal). */
export function Confirmer({ titre, message, libelle, onOui, onNon, occupe }: {
  titre: string; message: string; libelle: string; onOui: () => void; onNon: () => void; occupe?: boolean;
}) {
  return (
    <div className="carte confirmer" role="dialog" aria-label={titre}>
      <h3>{titre}</h3>
      <p>{message}</p>
      <div className="ligne">
        <button className="btn" onClick={onNon} disabled={occupe}>Annuler</button>
        <button className="btn principal" onClick={onOui} disabled={occupe}>{libelle}</button>
      </div>
    </div>
  );
}
