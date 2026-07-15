/**
 * Sélection multi-lignes réutilisable — hook + UI (checkbox, barre d'actions).
 *
 *   const selection = useRowSelection(liste, (d) => d.id);
 *   <Checkbox checked={selection.isSelected(d.id)} onChange={() => selection.toggle(d.id)} />
 *   <SelectionBar count={selection.count} label="dossier"
 *                 onDelete={() => setBulkDeleting(true)} onClear={selection.clear} />
 *
 * La sélection est réinitialisée dès que la liste sous-jacente change
 * (nouveau filtre, recherche, suppression) pour éviter de conserver des id
 * qui ne correspondent plus à rien.
 */
import { useEffect, useRef, useState } from 'react';

export function useRowSelection<T>(items: T[], getId: (item: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Retire de la sélection les id qui ne correspondent plus à la liste courante
  // (élément supprimé, filtre changé) sans réinitialiser le reste.
  useEffect(() => {
    const validIds = new Set(items.map(getId));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items, getId]);

  const isSelected = (id: string) => selected.has(id);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleMany = (ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) { if (checked) next.add(id); else next.delete(id); }
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  return { selected, count: selected.size, isSelected, toggle, toggleMany, clear };
}

export function Checkbox({
  checked, indeterminate = false, onChange, ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
    />
  );
}

export function SelectionBar({
  count, label = 'élément', onDelete, onClear,
}: {
  count: number;
  label?: string;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="selection-bar">
      <span>{count} {label}{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}</span>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
          Annuler la sélection
        </button>
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                onClick={onDelete}>
          Supprimer la sélection
        </button>
      </div>
    </div>
  );
}
