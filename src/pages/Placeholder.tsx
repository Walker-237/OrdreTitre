/**
 * Placeholder réutilisé pour les pages non encore portées.
 * Affiche un titre + un message « tranche suivante ».
 */
export function Placeholder({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-subtitle">{hint ?? 'Page à porter dans la prochaine tranche'}</div>
        </div>
      </div>
      <div className="card">
        <div className="empty">
          <div className="em-title">À venir</div>
          <div>Cette page sera portée depuis <code>Audience/src/app/pages</code> à la prochaine étape.</div>
        </div>
      </div>
    </>
  );
}
