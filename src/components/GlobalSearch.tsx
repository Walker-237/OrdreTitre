/**
 * Recherche globale — alimente la barre de la topbar. Indexe à la volée
 * toutes les entités principales (dossiers, audiences, délibérés,
 * avocats, agents, juridictions, honoraires, jurisprudence) et affiche
 * les résultats groupés dans un dropdown.
 *
 * Filtre insensible casse/accents, navigation clavier (↑/↓, Entrée, Échap).
 * Chaque résultat navigue vers la page la plus pertinente :
 *   - Dossier            → /dossiers/{id}
 *   - Audience/Délibéré  → dossier parent (toutes deux y sont listées)
 *   - Honoraire          → dossier parent
 *   - Avocat/Agent       → /intervenants
 *   - Juridiction        → /juridictions
 *   - Jurisprudence      → /jurisprudence
 */
import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { formatDate, formatMontantCourt } from '../labels';

interface SearchHit {
  /** Catégorie d'entité pour le groupement visuel. */
  category: string;
  /** Pictogramme inline (emoji ou caractère). */
  icon: string;
  /** Libellé principal (titre du résultat). */
  primary: string;
  /** Libellé secondaire (sous-titre — contexte ou méta). */
  secondary: string;
  /** Route de destination. */
  to: string;
}

const MIN_QUERY_LEN = 2;
const MAX_PER_CATEGORY = 5;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Renvoie true si chaque token (séparé par espace) est présent dans `hay`. */
function matchesAll(hay: string, qNorm: string): boolean {
  if (!qNorm) return false;
  const tokens = qNorm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => hay.includes(t));
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const {
    dossiers, audiences, deliberes, avocats, agents,
    juridictions, honoraires, jurisprudence,
  } = useStore();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Map id → référence dossier (pour les libellés secondaires).
  const dossierRefById = useMemo(
    () => new Map(dossiers.map((d) => [d.id, d.reference])),
    [dossiers],
  );

  // ── Index recherchable : précalcule pour chaque entité un blob normalisé. ─
  const index = useMemo(() => {
    type Indexed<T> = { item: T; blob: string };
    const dossiersIdx: Indexed<typeof dossiers[number]>[] = dossiers.map((d) => ({
      item: d,
      blob: normalize([
        d.reference, d.intitule, d.sousNature, d.juridiction, d.ville,
        d.agent, d.avocat,
        ...(d.parties ?? []).map((p) => `${p.nomRaisonSociale} ${p.prenom ?? ''}`),
      ].join(' ')),
    }));
    const audiencesIdx: Indexed<typeof audiences[number]>[] = audiences.map((a) => ({
      item: a,
      blob: normalize([
        a.objet, a.juridiction, a.numeroRole ?? '', a.salleAudience ?? '',
        a.agent ?? '', dossierRefById.get(a.dossierId) ?? '',
      ].join(' ')),
    }));
    const deliberesIdx: Indexed<typeof deliberes[number]>[] = deliberes.map((d) => ({
      item: d,
      blob: normalize([
        dossierRefById.get(d.dossierId) ?? '',
        d.dispositif ?? '', d.decision ?? '', d.observations ?? '',
      ].join(' ')),
    }));
    const avocatsIdx: Indexed<typeof avocats[number]>[] = avocats.map((a) => ({
      item: a,
      blob: normalize([
        a.nom, a.prenom ?? '', a.cabinet, a.barreau ?? '', a.email, a.ville,
        ...(a.specialites ?? []),
      ].join(' ')),
    }));
    const agentsIdx: Indexed<typeof agents[number]>[] = agents.map((a) => ({
      item: a,
      blob: normalize([
        a.nom, a.prenom ?? '', a.matricule ?? '', a.poste, a.fonction, a.direction, a.email,
      ].join(' ')),
    }));
    const juridictionsIdx: Indexed<typeof juridictions[number]>[] = juridictions.map((j) => ({
      item: j,
      blob: normalize([j.libelle, j.ville, j.pays, j.emailGreffe ?? ''].join(' ')),
    }));
    const honorairesIdx: Indexed<typeof honoraires[number]>[] = honoraires.map((h) => ({
      item: h,
      blob: normalize([
        h.referenceFacture ?? '', dossierRefById.get(h.dossierId) ?? '',
        h.observations ?? '',
      ].join(' ')),
    }));
    const jurisprudenceIdx: Indexed<typeof jurisprudence[number]>[] = jurisprudence.map((j) => ({
      item: j,
      blob: normalize([
        j.reference, j.juridiction, j.titre ?? '', j.resume,
        ...(j.motsCles ?? []),
      ].join(' ')),
    }));
    return {
      dossiersIdx, audiencesIdx, deliberesIdx, avocatsIdx, agentsIdx,
      juridictionsIdx, honorairesIdx, jurisprudenceIdx,
    };
  }, [
    dossiers, audiences, deliberes, avocats, agents,
    juridictions, honoraires, jurisprudence, dossierRefById,
  ]);

  // ── Résultats par catégorie (cap MAX_PER_CATEGORY). ─────────────────────
  const groupedHits = useMemo(() => {
    const qNorm = normalize(query.trim());
    if (qNorm.length < MIN_QUERY_LEN) return [] as { label: string; hits: SearchHit[] }[];

    const groups: { label: string; hits: SearchHit[] }[] = [];

    const dossiersHits: SearchHit[] = index.dossiersIdx
      .filter((x) => matchesAll(x.blob, qNorm))
      .slice(0, MAX_PER_CATEGORY)
      .map(({ item: d }) => ({
        category: 'Dossiers', icon: '☷',
        primary: `${d.reference} — ${d.intitule}`,
        secondary: `${d.juridiction} · ${formatMontantCourt(d.montantEnJeu, d.devise)}`,
        to: `/dossiers/${d.id}`,
      }));
    if (dossiersHits.length) groups.push({ label: 'Dossiers', hits: dossiersHits });

    const audiencesHits: SearchHit[] = index.audiencesIdx
      .filter((x) => matchesAll(x.blob, qNorm))
      .slice(0, MAX_PER_CATEGORY)
      .map(({ item: a }) => ({
        category: 'Audiences', icon: '▤',
        primary: `${formatDate(a.date)} ${a.heure} — ${a.objet}`,
        secondary: `${dossierRefById.get(a.dossierId) ?? '—'} · ${a.juridiction}`,
        to: `/dossiers/${a.dossierId}`,
      }));
    if (audiencesHits.length) groups.push({ label: 'Audiences', hits: audiencesHits });

    const deliberesHits: SearchHit[] = index.deliberesIdx
      .filter((x) => matchesAll(x.blob, qNorm))
      .slice(0, MAX_PER_CATEGORY)
      .map(({ item: d }) => ({
        category: 'Délibérés', icon: '◆',
        primary: `Délibéré du ${formatDate(d.dateDelibere)}`,
        secondary: `${dossierRefById.get(d.dossierId) ?? '—'}${
          d.dispositif ? ` · ${d.dispositif.slice(0, 60)}` : ''
        }`,
        to: `/dossiers/${d.dossierId}`,
      }));
    if (deliberesHits.length) groups.push({ label: 'Délibérés', hits: deliberesHits });

    const intervenantsHits: SearchHit[] = [
      ...index.avocatsIdx
        .filter((x) => matchesAll(x.blob, qNorm))
        .map(({ item: a }) => ({
          category: 'Avocats', icon: '⚖',
          primary: `${a.prenom ? `${a.prenom} ` : ''}${a.nom}`,
          secondary: `${a.cabinet}${a.ville ? ` · ${a.ville}` : ''}`,
          to: '/intervenants',
        } as SearchHit)),
      ...index.agentsIdx
        .filter((x) => matchesAll(x.blob, qNorm))
        .map(({ item: a }) => ({
          category: 'Agents', icon: '▲',
          primary: `${a.prenom ? `${a.prenom} ` : ''}${a.nom}`,
          secondary: `${a.poste}${a.direction ? ` · ${a.direction}` : ''}`,
          to: '/intervenants',
        } as SearchHit)),
    ].slice(0, MAX_PER_CATEGORY);
    if (intervenantsHits.length) groups.push({ label: 'Intervenants', hits: intervenantsHits });

    const juridictionsHits: SearchHit[] = index.juridictionsIdx
      .filter((x) => matchesAll(x.blob, qNorm))
      .slice(0, MAX_PER_CATEGORY)
      .map(({ item: j }) => ({
        category: 'Juridictions', icon: '🏛',
        primary: j.libelle,
        secondary: `${j.ville}${j.pays ? `, ${j.pays}` : ''}`,
        to: '/juridictions',
      }));
    if (juridictionsHits.length) groups.push({ label: 'Juridictions', hits: juridictionsHits });

    const honorairesHits: SearchHit[] = index.honorairesIdx
      .filter((x) => matchesAll(x.blob, qNorm))
      .slice(0, MAX_PER_CATEGORY)
      .map(({ item: h }) => ({
        category: 'Honoraires', icon: '₡',
        primary: h.referenceFacture ?? `Facture ${formatDate(h.dateFacture)}`,
        secondary: `${dossierRefById.get(h.dossierId) ?? '—'} · ${formatMontantCourt(h.montantFacture)}`,
        to: `/dossiers/${h.dossierId}`,
      }));
    if (honorairesHits.length) groups.push({ label: 'Honoraires', hits: honorairesHits });

    const jurisprudenceHits: SearchHit[] = index.jurisprudenceIdx
      .filter((x) => matchesAll(x.blob, qNorm))
      .slice(0, MAX_PER_CATEGORY)
      .map(({ item: j }) => ({
        category: 'Jurisprudence', icon: '☰',
        primary: j.titre ? `${j.reference} — ${j.titre}` : j.reference,
        secondary: `${j.juridiction} · ${formatDate(j.date)}`,
        to: '/jurisprudence',
      }));
    if (jurisprudenceHits.length) groups.push({ label: 'Jurisprudence', hits: jurisprudenceHits });

    return groups;
  }, [query, index, dossierRefById]);

  // Liste plate utilisée pour la navigation au clavier.
  const flatHits = useMemo(
    () => groupedHits.flatMap((g) => g.hits),
    [groupedHits],
  );

  const totalCount = flatHits.length;

  useEffect(() => {
    if (highlight >= totalCount) setHighlight(0);
  }, [totalCount, highlight]);

  // Ferme au clic à l'extérieur.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function gotoHit(hit: SearchHit) {
    navigate(hit.to);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(totalCount - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      if (open && flatHits[highlight]) {
        e.preventDefault();
        gotoHit(flatHits[highlight]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  const showDropdown = open && query.trim().length >= MIN_QUERY_LEN;

  let runningIndex = -1;

  return (
    <div ref={wrapperRef} className="topbar-search" style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Rechercher un dossier, une partie, un avocat, une référence…"
        maxLength={100}
        autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {showDropdown && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: 'var(--white)', border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
            zIndex: 300, maxHeight: 480, overflowY: 'auto',
          }}
        >
          {totalCount === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--gray-500)', fontStyle: 'italic' }}>
              Aucun résultat pour « {query} ».
            </div>
          ) : (
            <>
              <div style={{
                padding: '8px 14px', fontSize: 11, color: 'var(--gray-500)',
                borderBottom: '1px solid var(--gray-200)',
              }}>
                {totalCount} résultat{totalCount > 1 ? 's' : ''} — ↑ ↓ Entrée pour naviguer, Échap pour fermer
              </div>
              {groupedHits.map((g) => (
                <div key={g.label}>
                  <div style={{
                    padding: '8px 14px 4px', fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gray-500)',
                  }}>
                    {g.label}
                  </div>
                  {g.hits.map((hit) => {
                    runningIndex += 1;
                    const i = runningIndex;
                    const active = i === highlight;
                    return (
                      <button
                        key={`${g.label}-${i}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setHighlight(i)}
                        onMouseDown={(e) => { e.preventDefault(); gotoHit(hit); }}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '8px 14px', border: 'none',
                          background: active ? 'var(--gray-100)' : 'transparent',
                          display: 'flex', alignItems: 'center', gap: 10,
                          cursor: 'pointer', font: 'inherit', color: 'inherit',
                        }}
                      >
                        <span style={{ fontSize: 14, width: 18, textAlign: 'center', color: 'var(--gray-500)' }}>
                          {hit.icon}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            display: 'block', fontSize: 13, fontWeight: 600,
                            color: 'var(--black)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {hit.primary}
                          </span>
                          <span style={{
                            display: 'block', fontSize: 11, color: 'var(--gray-500)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {hit.secondary}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
