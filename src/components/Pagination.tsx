/**
 * Pagination réutilisable — hook + composant UI.
 *
 *   const { page, pageSize, pageItems, setPage, setPageSize, totalPages }
 *     = usePagination(items, 25);
 *
 *   <Pagination total={items.length} page={page} pageSize={pageSize}
 *               onPageChange={setPage} onPageSizeChange={setPageSize} />
 *
 * Reset automatique vers la page 1 dès que la longueur des items change
 * (changement de filtre, de recherche, etc.).
 */
import { useEffect, useMemo, useState } from 'react';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function usePagination<T>(items: T[], initialPageSize: PageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(initialPageSize);

  // Reset automatique : nouveau filtre / nouveau pageSize → page 1.
  useEffect(() => { setPage(1); }, [items.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = useMemo(
    () => items.slice(start, start + pageSize),
    [items, start, pageSize],
  );

  return { page: safePage, pageSize, totalPages, pageItems, setPage, setPageSize };
}

interface PaginationProps {
  total: number;
  page: number;
  pageSize: PageSize;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: PageSize) => void;
  /** Libellé du type d'élément paginé (ex. « dossier », « audience »). */
  itemLabel?: string;
}

export function Pagination({
  total, page, pageSize, onPageChange, onPageSizeChange,
  itemLabel = 'élément',
}: PaginationProps) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  // Pages visibles : on borne autour de la page courante pour ne pas surcharger.
  const pages = computePageList(page, totalPages);

  return (
    <div className="pagination">
      <div className="pagination-info">
        <span className="muted">
          {start.toLocaleString('fr-FR')}–{end.toLocaleString('fr-FR')} sur{' '}
          {total.toLocaleString('fr-FR')} {itemLabel}{total > 1 ? 's' : ''}
        </span>
      </div>
      <div className="pagination-controls">
        <label className="pagination-size">
          <span className="muted">Par page</span>
          <select value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}>
            {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="pagination-pages">
          <button type="button" className="pg-btn" disabled={page <= 1}
                  onClick={() => onPageChange(1)} aria-label="Première page">«</button>
          <button type="button" className="pg-btn" disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)} aria-label="Page précédente">‹</button>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="pg-gap">…</span>
            ) : (
              <button key={p} type="button"
                      className={`pg-btn${p === page ? ' active' : ''}`}
                      onClick={() => onPageChange(p)}>{p}</button>
            ),
          )}
          <button type="button" className="pg-btn" disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)} aria-label="Page suivante">›</button>
          <button type="button" className="pg-btn" disabled={page >= totalPages}
                  onClick={() => onPageChange(totalPages)} aria-label="Dernière page">»</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renvoie la liste de pages à afficher avec ellipses :
 *   [1, '…', 4, 5, 6, '…', 12]    (page courante = 5, total = 12)
 *   [1, 2, 3, 4, 5]                (total ≤ 7)
 */
function computePageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  // On garde 2 et total-1 si on est près des bornes pour éviter une ellipse seule.
  if (current <= 3) { set.add(2); set.add(3); set.add(4); }
  if (current >= total - 2) { set.add(total - 1); set.add(total - 2); set.add(total - 3); }
  const pages = Array.from(set).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) out.push('…');
    out.push(pages[i]);
  }
  return out;
}
