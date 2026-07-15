/**
 * Sélecteur filtrable au clavier — remplacement de `<select>` quand la liste
 * vient d'entités enregistrées (dossiers, juridictions, avocats, agents…) où
 * le typeahead « 1 lettre » natif est insuffisant.
 *
 * Tape pour filtrer (insensible à la casse/accents), ↑/↓ pour naviguer,
 * Entrée pour valider, Échap pour fermer.
 */
import {
  useEffect, useId, useMemo, useRef, useState,
  type KeyboardEvent,
} from 'react';

export interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  /** Texte affiché tant qu'aucune valeur n'est choisie (ex. « — Sélectionner — »). */
  placeholder?: string;
  /** Si `true`, un champ caché impose la sélection au moment du submit HTML5. */
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** Message dans la liste quand le filtre ne renvoie rien. */
  emptyMessage?: string;
}

function normalize(s: string): string {
  // Retire les diacritiques (̀-ͯ = bloc « Combining Diacritical Marks »).
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function SearchableSelect({
  options, value, onChange,
  placeholder = '— Sélectionner —',
  required = false, disabled = false, id, emptyMessage = 'Aucun résultat',
}: SearchableSelectProps) {
  const autoId = useId();
  const listboxId = `${id ?? autoId}-listbox`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query]);

  // Garde l'index courant dans les bornes quand le filtre change.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  // Ferme au clic à l'extérieur.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) closeAndReset();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function closeAndReset() {
    setOpen(false);
    setQuery('');
  }

  function pick(opt: SearchableOption) {
    onChange(opt.value);
    closeAndReset();
    inputRef.current?.blur();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault();
        pick(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        closeAndReset();
        inputRef.current?.blur();
      }
    } else if (e.key === 'Tab') {
      closeAndReset();
    }
  }

  // Affichage de l'input : ce que l'utilisateur tape s'il filtre, sinon le
  // libellé de la valeur sélectionnée (ou vide).
  const displayValue = open ? query : (selected?.label ?? '');

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        // Sélectionne le texte au focus pour permettre l'écrasement rapide.
        onClick={() => { if (!open) setOpen(true); }}
        style={{ paddingRight: 28, cursor: disabled ? 'not-allowed' : 'text' }}
      />
      {/* Chevron purement décoratif. */}
      <span aria-hidden="true" style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        fontSize: 10, color: 'var(--gray-500)', pointerEvents: 'none',
      }}>▾</span>

      {/* Champ caché pour la validation HTML5 (required) — sa valeur reflète
          la sélection effective, pas le texte de filtre. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => { /* contrôlé par le parent */ }}
          style={{
            position: 'absolute', opacity: 0, height: 0, width: 0,
            border: 0, padding: 0, margin: 0, pointerEvents: 'none',
          }}
        />
      )}

      {open && !disabled && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            zIndex: 50, maxHeight: 240, overflowY: 'auto',
            background: 'var(--white)', border: '1px solid var(--gray-300)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
            margin: 0, padding: 4, listStyle: 'none',
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: '8px 10px', fontSize: 12, color: 'var(--gray-500)', fontStyle: 'italic' }}>
              {emptyMessage}
            </li>
          ) : filtered.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === highlight;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  padding: '8px 10px', fontSize: 13, borderRadius: 4, cursor: 'pointer',
                  background: isActive ? 'var(--gray-100)' : 'transparent',
                  color: isSelected ? 'var(--red)' : 'var(--black)',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
