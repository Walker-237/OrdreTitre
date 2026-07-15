/**
 * Page Rapports & analyses — fusion des anciennes pages « Reporting » (vue
 * statistique d'activité) et « Rapports & exports » (6 rapports métier
 * exportables PDF/Excel) en un point d'entrée unique.
 *
 * L'utilisateur règle ses filtres en haut de page (période, nature, statut,
 * risque, agent, avocat). Tout ce qui suit — KPIs, charts, et même les 6
 * rapports exportables — est recalculé sur la base filtrée.
 *
 * Les rapports génèrent des `ExportSection[]` côté navigateur (aucune
 * dépendance serveur) ; le déclencheur est journalisé dans l'audit local.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import {
  formatMontantCourt,
  LBL_NATURE, LBL_RISQUE, LBL_STATUT_DOSSIER,
} from '../labels';
import {
  NATURE_PROCEDURE, RISQUE, STATUT_DOSSIER,
  type NatureProcedure, type RisqueLevel, type StatutDossier,
} from '../models';
import { SearchableSelect } from '../components/SearchableSelect';
import { exportPdf, exportExcel, type ExportSection } from '../lib/export';
import {
  rapportCompletudeTracabilite,
  rapportDelaisRecours,
  rapportDoublonsChargeAvocats,
  rapportJurisprudenceInterne,
  rapportProvisionsLitiges,
  rapportTauxImmobilisation,
} from '../lib/reports';

interface RapportConfig {
  id: string;
  icon: string;
  titre: string;
  sousTitre: string;
  description: string;
  bullets: string[];
  build: () => ExportSection[];
}

export function Rapports() {
  const {
    dossiers, audiences, deliberes, avocats, agents, honoraires, jurisprudence,
  } = useStore();
  const { user } = useAuth();
  const auteur = user.nomAffichage || user.login;

  // ── Filtres (état local). Périmètre par défaut = tout. ──────────────────
  const [dateMin, setDateMin] = useState('');
  const [dateMax, setDateMax] = useState('');
  const [naturesSel, setNaturesSel] = useState<Set<NatureProcedure>>(new Set());
  const [statutsSel, setStatutsSel] = useState<Set<StatutDossier>>(new Set());
  const [risquesSel, setRisquesSel] = useState<Set<RisqueLevel>>(new Set());
  const [agentId, setAgentId] = useState('');
  const [avocatId, setAvocatId] = useState('');
  const [seuilImmobilisation, setSeuilImmobilisation] = useState(5); // %

  const toggle = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  };

  const filtresActifs =
    !!dateMin || !!dateMax || naturesSel.size > 0 || statutsSel.size > 0 ||
    risquesSel.size > 0 || !!agentId || !!avocatId;

  function resetFiltres() {
    setDateMin(''); setDateMax('');
    setNaturesSel(new Set()); setStatutsSel(new Set()); setRisquesSel(new Set());
    setAgentId(''); setAvocatId('');
  }

  // ── Données filtrées (cascade depuis les dossiers vers les entités liées) ─
  const dossiersF = useMemo(() => {
    return dossiers.filter((d) => {
      if (dateMin && d.dateOuverture < dateMin) return false;
      if (dateMax && d.dateOuverture > dateMax) return false;
      if (naturesSel.size > 0 && !naturesSel.has(d.nature)) return false;
      if (statutsSel.size > 0 && !statutsSel.has(d.statut)) return false;
      if (risquesSel.size > 0 && !risquesSel.has(d.risque)) return false;
      if (agentId && d.agentId !== agentId) return false;
      if (avocatId && d.avocatId !== avocatId) return false;
      return true;
    });
  }, [dossiers, dateMin, dateMax, naturesSel, statutsSel, risquesSel, agentId, avocatId]);

  const dossierIdsF = useMemo(() => new Set(dossiersF.map((d) => d.id)), [dossiersF]);
  const audiencesF = useMemo(() => audiences.filter((a) => dossierIdsF.has(a.dossierId)),
    [audiences, dossierIdsF]);
  const deliberesF = useMemo(() => deliberes.filter((d) => dossierIdsF.has(d.dossierId)),
    [deliberes, dossierIdsF]);
  const honorairesF = useMemo(() => honoraires.filter((h) => dossierIdsF.has(h.dossierId)),
    [honoraires, dossierIdsF]);

  // ── Statistiques agrégées ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const actifs = dossiersF.filter((d) => d.statut !== 'CLOTURE' && d.statut !== 'ARCHIVE');
    const closed = dossiersF.filter((d) => d.statut === 'CLOTURE' || d.statut === 'ARCHIVE');
    const montantActif = actifs.reduce((s, d) => s + d.montantEnJeu, 0);
    const montantTotal = dossiersF.reduce((s, d) => s + d.montantEnJeu, 0);
    const decisionsRendues = deliberesF.filter((d) => d.statut === 'RENDU');
    const favorables = decisionsRendues.filter((d) => d.resultat === 'FAVORABLE').length;
    const defavorables = decisionsRendues.filter((d) => d.resultat === 'DEFAVORABLE').length;
    const mixtes = decisionsRendues.filter(
      (d) => d.resultat === 'MIXTE' || d.resultat === 'PARTIEL').length;
    const tauxSucces = decisionsRendues.length > 0
      ? Math.round((favorables * 100) / decisionsRendues.length) : 0;
    const factureCumul = honorairesF.reduce((s, h) => s + h.montantFacture, 0);
    const payeCumul = honorairesF.reduce((s, h) => s + h.montantPaye, 0);

    const parNature = NATURE_PROCEDURE.map((n) => ({
      key: n, label: LBL_NATURE[n], count: dossiersF.filter((d) => d.nature === n).length,
    })).filter((x) => x.count > 0);

    const parStatut = STATUT_DOSSIER.map((s) => ({
      key: s, label: LBL_STATUT_DOSSIER[s], count: dossiersF.filter((d) => d.statut === s).length,
    })).filter((x) => x.count > 0);

    const parRisque = RISQUE.map((r) => ({
      key: r, label: LBL_RISQUE[r], count: dossiersF.filter((d) => d.risque === r).length,
    })).filter((x) => x.count > 0);

    // Top 5 dossiers à risque élevé par montant.
    const topRisque = [...dossiersF]
      .filter((d) => d.risque === 'ELEVE' && d.statut !== 'CLOTURE' && d.statut !== 'ARCHIVE')
      .sort((a, b) => b.montantEnJeu - a.montantEnJeu)
      .slice(0, 5);

    // Échéances à 30 jours.
    const now = Date.now();
    const echeances30j = dossiersF.filter((d) => {
      if (!d.prochaineEcheance) return false;
      const t = new Date(d.prochaineEcheance).getTime();
      return t >= now && t - now <= 30 * 86_400_000;
    }).length;

    return {
      total: dossiersF.length, actifs: actifs.length, closed: closed.length,
      montantActif, montantTotal,
      audiences: audiencesF.length,
      decisionsRendues: decisionsRendues.length, favorables, defavorables, mixtes,
      tauxSucces, factureCumul, payeCumul,
      parNature, parStatut, parRisque, topRisque, echeances30j,
    };
  }, [dossiersF, audiencesF, deliberesF, honorairesF]);

  const maxParNature = Math.max(1, ...stats.parNature.map((x) => x.count));
  const maxParStatut = Math.max(1, ...stats.parStatut.map((x) => x.count));

  // ── Options SearchableSelect (« — Tous — » via placeholder) ─────────────
  const agentOptions = useMemo(
    () => agents.map((a) => ({
      value: a.id,
      label: `${a.prenom ? `${a.prenom} ` : ''}${a.nom}${a.poste ? ` — ${a.poste}` : ''}`,
    })),
    [agents],
  );
  const avocatOptions = useMemo(
    () => avocats.map((a) => ({
      value: a.id,
      label: `${a.prenom ? `${a.prenom} ` : ''}${a.nom} — ${a.cabinet}`,
    })),
    [avocats],
  );

  // ── Rapports exportables ─────────────────────────────────────────────────
  const [busy, setBusy] = useState<string | null>(null);
  const rapports: RapportConfig[] = [
    {
      id: 'provisions', icon: '💰',
      titre: 'Provisions sur litiges', sousTitre: 'Évaluation fiable des provisions',
      description:
        'Estime la provision recommandée pour chaque dossier actif, agrégée par niveau de risque, ' +
        'avec un barème FAIBLE 10 % / MOYEN 50 % / ELEVE 90 %.',
      bullets: [
        'Synthèse par risque + détail dossier par dossier',
        'Conforme à la logique IFRS / SYSCOHADA',
        'Base de provisionnement comptable de la DAJ',
      ],
      build: () => rapportProvisionsLitiges(dossiersF),
    },
    {
      id: 'recours', icon: '⏰',
      titre: 'Délais de recours', sousTitre: 'Élimination des délais manqués',
      description:
        'Calcule la date limite de recours pour chaque délibéré (selon matière et voie), ' +
        'classe en dépassés / imminents (J-7) / à venir.',
      bullets: [
        'Mise en évidence des dépassements (action immédiate)',
        'Préparation des diligences à 7 jours',
        'Source : modèle DELAIS_RECOURS_JOURS du cahier des charges',
      ],
      build: () => rapportDelaisRecours(deliberesF, dossiersF),
    },
    {
      id: 'completude', icon: '📋',
      titre: 'Complétude & traçabilité', sousTitre: 'Score documentaire par dossier',
      description:
        'Score pondéré sur 8 critères (pièces, parties, juridiction, avocat, agent, résumé) — ' +
        'repère les dossiers actifs incomplets.',
      bullets: [
        'Vue d\'ensemble + sous-rapport « dossiers < 50 % »',
        'Compte les audiences et délibérés rattachés',
        'Date de dernière mise à jour pour mesurer l\'activité',
      ],
      build: () => rapportCompletudeTracabilite(dossiersF, audiencesF, deliberesF),
    },
    {
      id: 'doublons-charge', icon: '👥',
      titre: 'Doublons & charge avocats', sousTitre: 'Pilotage de la charge cabinet',
      description:
        'Détecte les dossiers candidats doublons (intitulés identiques) et tableau de charge ' +
        'par avocat externe (actifs vs seuil + audiences à venir).',
      bullets: [
        'Section A : groupes de doublons potentiels',
        'Section B : taux de saturation par cabinet',
        'Code couleur : 🔴 saturé / 🟠 tendu / 🟢 OK',
      ],
      build: () => rapportDoublonsChargeAvocats(dossiersF, audiencesF, avocats),
    },
    {
      id: 'immobilisation', icon: '🏦',
      titre: 'Taux d\'immobilisation', sousTitre: 'Conformité réglementaire',
      description:
        'Confronte le total des provisions au montant total engagé. Affiche le ratio agrégé et ' +
        'le décompose par nature, avec un seuil réglementaire paramétrable.',
      bullets: [
        'Synthèse : conforme / dépassement',
        'Décomposition par nature (pénale, civile, …)',
        'Seuil COBAC indicatif — ajustable ci-dessous',
      ],
      build: () => rapportTauxImmobilisation(dossiersF, seuilImmobilisation / 100),
    },
    {
      id: 'jurisprudence', icon: '📚',
      titre: 'Jurisprudence interne annotée', sousTitre: 'Construction du référentiel doctrinal',
      description:
        'Restitue l\'intégralité des décisions référencées avec leurs annotations, mots-clés et ' +
        'statut de publication, plus une ventilation par matière.',
      bullets: [
        'Couvre les décisions internes saisies par les juristes',
        'Inclut les annotations doctrinales',
        'Base pour alimenter une note de doctrine périodique',
      ],
      // La jurisprudence n'est pas filtrée par dossier — c'est un référentiel transverse.
      build: () => rapportJurisprudenceInterne(jurisprudence),
    },
  ];

  function describeFiltres(): string[] {
    const parts: string[] = [];
    if (dateMin || dateMax) parts.push(`Période d'ouverture : ${dateMin || '…'} → ${dateMax || '…'}`);
    if (naturesSel.size) parts.push(`Natures : ${[...naturesSel].map((n) => LBL_NATURE[n]).join(', ')}`);
    if (statutsSel.size) parts.push(`Statuts : ${[...statutsSel].map((s) => LBL_STATUT_DOSSIER[s]).join(', ')}`);
    if (risquesSel.size) parts.push(`Risques : ${[...risquesSel].map((r) => LBL_RISQUE[r]).join(', ')}`);
    if (agentId) {
      const a = agents.find((x) => x.id === agentId);
      if (a) parts.push(`Agent : ${a.prenom ? `${a.prenom} ` : ''}${a.nom}`);
    }
    if (avocatId) {
      const a = avocats.find((x) => x.id === avocatId);
      if (a) parts.push(`Avocat : ${a.prenom ? `${a.prenom} ` : ''}${a.nom} — ${a.cabinet}`);
    }
    return parts;
  }

  const onExport = async (cfg: RapportConfig, format: 'pdf' | 'xlsx') => {
    const key = `${cfg.id}-${format}`;
    setBusy(key);
    try {
      const sections = cfg.build();
      const filtreNotes = describeFiltres();
      const meta = {
        titre: cfg.titre,
        sousTitre: cfg.sousTitre,
        auteur,
        notes: [
          `Cas d'usage : ${cfg.sousTitre}.`,
          `Périmètre filtré : ${dossiersF.length} dossier(s), ${audiencesF.length} audience(s), ` +
          `${deliberesF.length} délibéré(s), ${honorairesF.length} facture(s), ${avocats.length} avocat(s).`,
          ...(filtreNotes.length ? ['Filtres appliqués :', ...filtreNotes.map((s) => `  • ${s}`)] : []),
        ],
      };
      if (format === 'pdf') exportPdf(meta, sections);
      else exportExcel(meta, sections);
    } finally {
      setTimeout(() => setBusy(null), 300);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Rapports &amp; analyses</div>
          <div className="page-subtitle">
            Vue d'ensemble statistique et six rapports métier exportables — affinables par filtres.
          </div>
        </div>
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────────── */}
      <div className="card mb-20">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>Filtres</div>
          {filtresActifs && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFiltres}>
              Réinitialiser
            </button>
          )}
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Date d'ouverture (du)</label>
            <input type="date" value={dateMin} onChange={(e) => setDateMin(e.target.value)} />
          </div>
          <div className="field">
            <label>Date d'ouverture (au)</label>
            <input type="date" value={dateMax} onChange={(e) => setDateMax(e.target.value)} />
          </div>
          <div className="field">
            <label>Agent référent</label>
            <SearchableSelect
              value={agentId} onChange={setAgentId}
              options={agentOptions} placeholder="— Tous —"
            />
          </div>
          <div className="field">
            <label>Avocat mandaté</label>
            <SearchableSelect
              value={avocatId} onChange={setAvocatId}
              options={avocatOptions} placeholder="— Tous —"
            />
          </div>
          <div className="field full">
            <label>Nature</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {NATURE_PROCEDURE.map((n) => (
                <button key={n} type="button"
                        className={`filter-chip${naturesSel.has(n) ? ' active' : ''}`}
                        onClick={() => toggle(naturesSel, n, setNaturesSel)}>
                  {LBL_NATURE[n]}
                </button>
              ))}
            </div>
          </div>
          <div className="field full">
            <label>Statut</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {STATUT_DOSSIER.map((s) => (
                <button key={s} type="button"
                        className={`filter-chip${statutsSel.has(s) ? ' active' : ''}`}
                        onClick={() => toggle(statutsSel, s, setStatutsSel)}>
                  {LBL_STATUT_DOSSIER[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="field full">
            <label>Risque</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {RISQUE.map((r) => (
                <button key={r} type="button"
                        className={`filter-chip${risquesSel.has(r) ? ' active' : ''}`}
                        onClick={() => toggle(risquesSel, r, setRisquesSel)}>
                  {LBL_RISQUE[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtresActifs && (
          <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
            Périmètre filtré : <span className="fw-700">{dossiersF.length}</span> dossier(s),
            {' '}{audiencesF.length} audience(s), {deliberesF.length} délibéré(s),
            {' '}{honorairesF.length} facture(s).
          </div>
        )}
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Dossiers actifs</div>
          <div className="kpi-value">{stats.actifs}</div>
          <div className="kpi-trend">{stats.closed} clôturé(s)</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Montant en jeu</div>
          <div className="kpi-value">{formatMontantCourt(stats.montantActif)}</div>
          <div className="kpi-trend">cumulé dossiers actifs</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Décisions rendues</div>
          <div className="kpi-value">{stats.decisionsRendues}</div>
          <div className="kpi-trend up">{stats.favorables} favorable(s) · {stats.defavorables} défavorable(s)</div>
        </div>
        <div className="kpi dark">
          <div className="kpi-label">Taux de succès</div>
          <div className="kpi-value">{stats.tauxSucces}%</div>
          <div className="kpi-trend">{stats.echeances30j} échéance(s) ≤ 30 j</div>
        </div>
      </div>

      {/* ── Détail répartitions ────────────────────────────────────────── */}
      <div className="detail-grid">
        <div className="card">
          <div className="card-title">Répartition par nature</div>
          {stats.parNature.length === 0 ? (
            <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
              Aucun dossier dans le périmètre filtré.
            </div>
          ) : (
            <div className="kv-list">
              {stats.parNature.map((x) => (
                <div key={x.key}>
                  <div className="row between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{x.label}</span>
                    <span className="fw-700">{x.count}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${(x.count / maxParNature) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card-title mt-24">Répartition par statut</div>
          {stats.parStatut.length === 0 ? (
            <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>—</div>
          ) : (
            <div className="kv-list">
              {stats.parStatut.map((x) => (
                <div key={x.key}>
                  <div className="row between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{x.label}</span>
                    <span className="fw-700">{x.count}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${(x.count / maxParStatut) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {stats.topRisque.length > 0 && (
            <>
              <div className="card-title mt-24">Top dossiers — risque élevé</div>
              <div className="kv-list">
                {stats.topRisque.map((d) => (
                  <div key={d.id} className="kv-row">
                    <span className="k" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="fw-700" style={{ color: 'var(--black)' }}>{d.reference}</span>
                      <span style={{ fontSize: 11 }}>{d.intitule}</span>
                    </span>
                    <span className="v">{formatMontantCourt(d.montantEnJeu, d.devise)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="card mb-20">
            <div className="card-title">Niveau de risque</div>
            <div className="kv-list">
              {stats.parRisque.map((x) => (
                <div key={x.key} className="kv-row">
                  <span className="k">
                    <span className={`pill ${
                      x.key === 'ELEVE' ? 'red' : x.key === 'MOYEN' ? 'orange' : 'green'
                    }`}>
                      {x.label}
                    </span>
                  </span>
                  <span className="v">{x.count}</span>
                </div>
              ))}
              {stats.parRisque.length === 0 && (
                <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>—</div>
              )}
            </div>
          </div>

          <div className="card mb-20">
            <div className="card-title">Honoraires</div>
            <div className="kv-list">
              <div className="kv-row">
                <span className="k">Facturé</span>
                <span className="v">{formatMontantCourt(stats.factureCumul)}</span>
              </div>
              <div className="kv-row">
                <span className="k">Payé</span>
                <span className="v">{formatMontantCourt(stats.payeCumul)}</span>
              </div>
              <div className="kv-row">
                <span className="k">Restant</span>
                <span className="v">{formatMontantCourt(stats.factureCumul - stats.payeCumul)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Décisions rendues — détail</div>
            <div className="kv-list">
              <div className="kv-row">
                <span className="k"><span className="pill green">Favorable</span></span>
                <span className="v">{stats.favorables}</span>
              </div>
              <div className="kv-row">
                <span className="k"><span className="pill red">Défavorable</span></span>
                <span className="v">{stats.defavorables}</span>
              </div>
              <div className="kv-row">
                <span className="k"><span className="pill orange">Mixte/Partiel</span></span>
                <span className="v">{stats.mixtes}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Rapports exportables ───────────────────────────────────────── */}
      <div className="page-header mt-24">
        <div>
          <div className="card-title" style={{ margin: 0 }}>Rapports exportables</div>
          <div className="page-subtitle">
            Six rapports métier — calculés sur le périmètre filtré ci-dessus.
          </div>
        </div>
      </div>

      <div className="card mb-20">
        <div className="card-title">Paramètre — taux d'immobilisation</div>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 13 }}>Seuil réglementaire (%)</label>
          <input type="number" min={0} max={100} step={0.5}
                 value={seuilImmobilisation}
                 onChange={(e) => setSeuilImmobilisation(Number(e.target.value))}
                 style={{ width: 100, height: 32, padding: '0 10px',
                          border: '1px solid var(--gray-300)', borderRadius: 8 }} />
          <span className="muted" style={{ fontSize: 12 }}>
            Appliqué au rapport « Taux d'immobilisation ». Défaut : 5 % (indicatif COBAC).
          </span>
        </div>
      </div>

      <div className="detail-grid">
        {rapports.map((r) => (
          <RapportCard key={r.id} cfg={r}
                       busy={busy?.startsWith(r.id) ? (busy.endsWith('pdf') ? 'pdf' : 'xlsx') : null}
                       onExport={onExport} />
        ))}
      </div>
    </>
  );
}

function RapportCard({
  cfg, busy, onExport,
}: {
  cfg: RapportConfig;
  busy: 'pdf' | 'xlsx' | null;
  onExport: (cfg: RapportConfig, format: 'pdf' | 'xlsx') => void;
}) {
  return (
    <div className="card mb-20">
      <div className="row between mb-12">
        <div>
          <div className="card-title" style={{ margin: 0 }}>
            <span style={{ marginRight: 8 }}>{cfg.icon}</span>{cfg.titre}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{cfg.sousTitre}</div>
        </div>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.55 }}>{cfg.description}</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--gray-700, #444)' }}>
        {cfg.bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      <div className="row mt-16" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <BusyButton label="Export PDF" icon="📄" busy={busy === 'pdf'}
                    onClick={() => onExport(cfg, 'pdf')} />
        <BusyButton label="Export Excel" icon="📊" busy={busy === 'xlsx'}
                    onClick={() => onExport(cfg, 'xlsx')} primary />
      </div>
    </div>
  );
}

function BusyButton({
  label, icon, busy, onClick, primary,
}: {
  label: string; icon: ReactNode; busy: boolean;
  onClick: () => void; primary?: boolean;
}) {
  return (
    <button type="button"
            className={`btn ${primary ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            disabled={busy} onClick={onClick}>
      {busy ? 'Génération…' : <>{icon} {label}</>}
    </button>
  );
}
