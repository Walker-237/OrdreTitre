/**
 * Générateurs de rapports métier — 6 cas d'usage prioritaires DAJ AFB :
 *
 *  1) Provisions sur litiges     → exposition financière agrégée
 *  2) Délais de recours          → diligences à risque (manqués + à venir)
 *  3) Complétude & traçabilité   → état documentaire des dossiers
 *  4) Doublons & charge avocats  → équité d'allocation et qualité saisie
 *  5) Taux d'immobilisation      → conformité réglementaire (vs seuil)
 *  6) Jurisprudence interne      → base de connaissance annotée
 *
 * Chaque fonction renvoie `ExportSection[]` consommables par `exportPdf` /
 * `exportExcel` (cf. ./export.ts). Aucune dépendance UI — peut être appelé
 * depuis n'importe quelle page ou une éventuelle action serveur.
 */
import {
  type Audience, type Avocat, type Delibere, type Dossier, type Honoraire,
  type JurisprudenceEntry,
} from '../models';
import {
  LBL_NATURE, LBL_RESULTAT_DELIBERE, LBL_RISQUE, LBL_STATUT_DELIBERE,
  LBL_STATUT_DOSSIER, LBL_STATUT_PAIEMENT, LBL_TYPE_ACTION, LBL_VOIE_RECOURS,
} from '../labels';
import { dateLimiteRecours } from '../alertes-engine';
import type { ExportSection } from './export';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function fmtDate(s?: string): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR');
}
function diffJours(iso: string): number {
  const t = new Date(iso); const now = new Date();
  return Math.round((t.getTime() - now.getTime()) / 86_400_000);
}

// ────────────────────────────────────────────────────────────────────────────
// 1) Provisions sur litiges
//
// Recommandation IFRS / SYSCOHADA : provisionner une part du montant en jeu
// selon le risque (FAIBLE=10 %, MOYEN=50 %, ELEVE=90 %). Filtré aux dossiers
// actifs (hors CLOTURE / ARCHIVE). Ce barème reste paramétrable.
// ────────────────────────────────────────────────────────────────────────────

export const TAUX_PROVISION_PAR_RISQUE: Record<'FAIBLE' | 'MOYEN' | 'ELEVE', number> = {
  FAIBLE: 0.10, MOYEN: 0.50, ELEVE: 0.90,
};

export function rapportProvisionsLitiges(dossiers: Dossier[]): ExportSection[] {
  const actifs = dossiers.filter((d) => d.statut !== 'CLOTURE' && d.statut !== 'ARCHIVE');
  const totaux = { FAIBLE: 0, MOYEN: 0, ELEVE: 0 };
  const rows = actifs.map((d) => {
    const taux = TAUX_PROVISION_PAR_RISQUE[d.risque];
    const provision = Math.round(d.montantEnJeu * taux);
    totaux[d.risque] += provision;
    return [
      d.reference, d.intitule, LBL_NATURE[d.nature], LBL_STATUT_DOSSIER[d.statut],
      LBL_TYPE_ACTION[d.typeAction], LBL_RISQUE[d.risque],
      d.montantEnJeu, `${Math.round(taux * 100)}%`, provision, d.devise,
      d.juridiction, fmtDate(d.dateOuverture), fmtDate(d.prochaineEcheance),
    ];
  });
  const totalProvision = totaux.FAIBLE + totaux.MOYEN + totaux.ELEVE;
  const totalEnJeu = actifs.reduce((s, d) => s + d.montantEnJeu, 0);

  return [
    {
      title: 'Synthèse par niveau de risque',
      columns: ['Niveau', 'Nb dossiers', 'Montant en jeu (XAF)', 'Taux applicable', 'Provision recommandée (XAF)'],
      rows: (['ELEVE', 'MOYEN', 'FAIBLE'] as const).map((r) => {
        const subset = actifs.filter((d) => d.risque === r);
        const enJeu = subset.reduce((s, d) => s + d.montantEnJeu, 0);
        return [LBL_RISQUE[r], subset.length, enJeu, `${Math.round(TAUX_PROVISION_PAR_RISQUE[r] * 100)}%`, totaux[r]];
      }).concat([
        ['TOTAL', actifs.length, totalEnJeu, '—', totalProvision],
      ]),
      note: `${actifs.length} dossier(s) actif(s) — barème : FAIBLE 10 % / MOYEN 50 % / ELEVE 90 %`,
    },
    {
      title: 'Détail par dossier',
      columns: [
        'Réf', 'Intitulé', 'Nature', 'Statut', 'Position', 'Risque',
        'Montant en jeu', 'Taux', 'Provision', 'Devise',
        'Juridiction', 'Ouverture', 'Échéance',
      ],
      rows,
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// 2) Délais de recours — manqués + à venir
//
// Pour chaque délibéré rendu avec voie(s) de recours possible(s), calcule la
// date limite via `dateLimiteRecours()`. Trois groupes :
//   - dépassés (jours restants < 0 et recours non exercé) → RISQUE
//   - imminents (0 ≤ jours restants ≤ 7)                  → ALERTE
//   - à venir (> 7 jours)                                 → SUIVI
// ────────────────────────────────────────────────────────────────────────────

export function rapportDelaisRecours(
  deliberes: Delibere[], dossiers: Dossier[],
): ExportSection[] {
  const refByDossier = new Map(dossiers.map((d) => [d.id, d]));
  type Row = {
    delibere: Delibere; ref: string; intitule: string;
    voie: string; dateLimite: string; jours: number; matiere: string;
  };
  const enrich: Row[] = [];
  for (const de of deliberes) {
    if (de.statut !== 'RENDU') continue;
    const dossier = refByDossier.get(de.dossierId);
    if (!dossier) continue;
    const dateEff = de.dateDelibereEffectif ?? de.dateDelibere;
    for (const v of de.voiesRecours.filter((x) => x !== 'AUCUNE')) {
      const dl = dateLimiteRecours(dateEff, dossier.nature, v);
      if (!dl) continue;
      enrich.push({
        delibere: de,
        ref: dossier.reference,
        intitule: dossier.intitule,
        voie: LBL_VOIE_RECOURS[v],
        dateLimite: dl,
        jours: diffJours(dl),
        matiere: LBL_NATURE[dossier.nature],
      });
    }
  }
  const sortable = enrich.slice().sort((a, b) => a.jours - b.jours);
  const depasses  = sortable.filter((r) => r.jours < 0  && !r.delibere.recoursExerce);
  const imminents = sortable.filter((r) => r.jours >= 0 && r.jours <= 7);
  const futurs    = sortable.filter((r) => r.jours > 7);

  const fmtRow = (r: Row) => [
    r.ref, r.intitule, r.matiere, r.voie, fmtDate(r.dateLimite),
    r.jours, r.delibere.recoursExerce ? 'Oui' : 'Non',
    fmtDate(r.delibere.dateDelibere),
  ];
  const cols = ['Réf', 'Intitulé', 'Matière', 'Voie', 'Date limite', 'Jours restants', 'Recours exercé', 'Délibéré'];

  return [
    {
      title: '🚨 Délais dépassés (recours non exercé)',
      columns: cols, rows: depasses.map(fmtRow),
      note: depasses.length === 0 ? 'Aucun dépassement constaté.' : `${depasses.length} dépassement(s) — diligence immédiate requise.`,
    },
    {
      title: '⚠ Délais imminents (J-7)',
      columns: cols, rows: imminents.map(fmtRow),
      note: `${imminents.length} échéance(s) dans les 7 prochains jours.`,
    },
    {
      title: 'À venir (> J-7)',
      columns: cols, rows: futurs.map(fmtRow),
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// 3) Complétude & traçabilité
//
// Score documentaire = somme pondérée des critères :
//   - pièces ≥ 3            (poids 2)
//   - parties ≥ 1           (poids 2)
//   - juridiction renseignée(poids 1)
//   - avocat renseigné       (poids 1)
//   - agent renseigné        (poids 1)
//   - résumé des faits       (poids 1)
// Score maximum = 8. Affichage en pourcentage.
// ────────────────────────────────────────────────────────────────────────────

function calculerScoreCompletude(d: Dossier): { score: number; max: number } {
  let score = 0; const max = 8;
  if (d.pieces.length >= 3) score += 2;
  if (d.parties.length >= 1) score += 2;
  if (d.juridiction.trim()) score += 1;
  if (d.avocat.trim()) score += 1;
  if (d.agent.trim()) score += 1;
  if ((d.resumeFaits ?? '').trim().length >= 20) score += 1;
  return { score, max };
}

export function rapportCompletudeTracabilite(
  dossiers: Dossier[], audiences: Audience[], deliberes: Delibere[],
): ExportSection[] {
  const audiencesByDossier = audiences.reduce((m, a) => {
    m.set(a.dossierId, (m.get(a.dossierId) ?? 0) + 1); return m;
  }, new Map<string, number>());
  const deliberesByDossier = deliberes.reduce((m, d) => {
    m.set(d.dossierId, (m.get(d.dossierId) ?? 0) + 1); return m;
  }, new Map<string, number>());

  const rows = dossiers.map((d) => {
    const { score, max } = calculerScoreCompletude(d);
    return [
      d.reference, d.intitule, LBL_STATUT_DOSSIER[d.statut], d.pieces.length, d.parties.length,
      audiencesByDossier.get(d.id) ?? 0, deliberesByDossier.get(d.id) ?? 0,
      `${Math.round((score / max) * 100)}%`, d.agent || '—', d.avocat || '—',
      fmtDate(d.updatedAt ?? d.createdAt),
    ];
  });
  rows.sort((a, b) => parseInt(String(a[7]), 10) - parseInt(String(b[7]), 10));

  const incomplets = dossiers.filter((d) => {
    const { score, max } = calculerScoreCompletude(d);
    return score / max < 0.5 && d.statut !== 'CLOTURE' && d.statut !== 'ARCHIVE';
  });

  return [
    {
      title: 'Vue d\'ensemble — score documentaire',
      columns: ['Réf', 'Intitulé', 'Statut', 'Nb pièces', 'Nb parties', 'Audiences', 'Délibérés', 'Score', 'Agent', 'Avocat', 'Dernière MAJ'],
      rows,
      note: `Pondération : pièces≥3 (2), parties≥1 (2), juridiction/avocat/agent/résumé (1 chacun) — max 8.`,
    },
    {
      title: '⚠ Dossiers incomplets actifs (score < 50 %)',
      columns: ['Réf', 'Intitulé', 'Statut', 'Pièces', 'Parties', 'Agent', 'Avocat'],
      rows: incomplets.map((d) => [
        d.reference, d.intitule, LBL_STATUT_DOSSIER[d.statut],
        d.pieces.length, d.parties.length, d.agent || '—', d.avocat || '—',
      ]),
      note: `${incomplets.length} dossier(s) à compléter en priorité.`,
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// 4) Doublons & charge avocats
//
// A) Doublons potentiels : dossiers ayant
//     - même intitulé normalisé, OU
//     - mêmes parties principales (raisons sociales), OU
//     - même référence externe (numéro de rôle)
// B) Charge par avocat : nb dossiers actifs / seuil, nb audiences à venir,
//    taux de remplissage.
// ────────────────────────────────────────────────────────────────────────────

function normaliser(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

export function rapportDoublonsChargeAvocats(
  dossiers: Dossier[], audiences: Audience[], avocats: Avocat[],
): ExportSection[] {
  // A) Détection des doublons par intitulé normalisé
  const buckets = new Map<string, Dossier[]>();
  for (const d of dossiers) {
    const key = normaliser(d.intitule);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(d);
  }
  const doublons: Dossier[][] = [];
  for (const group of buckets.values()) {
    if (group.length > 1) doublons.push(group);
  }

  const doublonsRows = doublons.flatMap((group, gi) =>
    group.map((d) => [
      `#${gi + 1}`, d.reference, d.intitule, LBL_STATUT_DOSSIER[d.statut],
      d.agent, d.avocat, fmtDate(d.dateOuverture), d.montantEnJeu, d.devise,
    ]),
  );

  // B) Charge avocats
  const now = new Date().toISOString().slice(0, 10);
  const audiencesByAvocat = audiences.reduce((m, a) => {
    if (!a.avocatId || a.date < now) return m;
    m.set(a.avocatId, (m.get(a.avocatId) ?? 0) + 1); return m;
  }, new Map<string, number>());
  const dossiersByAvocat = dossiers.reduce((m, d) => {
    if (!d.avocatId) return m;
    if (d.statut === 'CLOTURE' || d.statut === 'ARCHIVE') return m;
    m.set(d.avocatId, (m.get(d.avocatId) ?? 0) + 1); return m;
  }, new Map<string, number>());

  const chargeRows = avocats
    .filter((a) => a.isActive)
    .map((a) => {
      const actifs = dossiersByAvocat.get(a.id) ?? a.dossiersActifs;
      const audiencesAVenir = audiencesByAvocat.get(a.id) ?? 0;
      const taux = a.seuilDossiersMax > 0 ? Math.round((actifs * 100) / a.seuilDossiersMax) : 0;
      return [
        `${a.prenom ?? ''} ${a.nom}`.trim(), a.cabinet, a.barreau ?? '—',
        actifs, a.seuilDossiersMax, `${taux}%`, audiencesAVenir,
        taux >= 100 ? '🔴 Saturé' : taux >= 80 ? '🟠 Tendu' : '🟢 OK',
      ];
    })
    .sort((a, b) => parseInt(String(b[5]), 10) - parseInt(String(a[5]), 10));

  return [
    {
      title: 'A — Doublons potentiels (intitulés identiques)',
      columns: ['Groupe', 'Réf', 'Intitulé', 'Statut', 'Agent', 'Avocat', 'Ouverture', 'Montant', 'Devise'],
      rows: doublonsRows,
      note: doublonsRows.length === 0
        ? 'Aucun doublon détecté.'
        : `${doublons.length} groupe(s) suspect(s) regroupant ${doublonsRows.length} dossier(s) — vérification manuelle requise.`,
    },
    {
      title: 'B — Charge par avocat',
      columns: ['Avocat', 'Cabinet', 'Barreau', 'Dossiers actifs', 'Seuil max', 'Taux', 'Audiences à venir', 'Statut'],
      rows: chargeRows,
      note: 'Seuils : ≥100 % saturé, 80-99 % tendu, <80 % OK.',
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// 5) Taux d'immobilisation
//
// Taux d'immobilisation = provisions sur litiges actifs / engagement total.
// `engagementTotal` correspond à la somme des montants en jeu. Comparaison
// avec un seuil réglementaire (paramétrable, défaut 5 % — COBAC indicatif).
// ────────────────────────────────────────────────────────────────────────────

export function rapportTauxImmobilisation(
  dossiers: Dossier[], seuilReglementaire = 0.05,
): ExportSection[] {
  const actifs = dossiers.filter((d) => d.statut !== 'CLOTURE' && d.statut !== 'ARCHIVE');
  const totalEnJeu = actifs.reduce((s, d) => s + d.montantEnJeu, 0);
  const totalProvision = actifs.reduce(
    (s, d) => s + d.montantEnJeu * TAUX_PROVISION_PAR_RISQUE[d.risque], 0,
  );
  const taux = totalEnJeu > 0 ? totalProvision / totalEnJeu : 0;

  const parNature = (['PENALE', 'SOCIALE', 'CIVILE', 'COMMERCIALE', 'ARBITRALE', 'AUTRE'] as const).map((n) => {
    const subset = actifs.filter((d) => d.nature === n);
    const enJeu = subset.reduce((s, d) => s + d.montantEnJeu, 0);
    const provision = subset.reduce(
      (s, d) => s + d.montantEnJeu * TAUX_PROVISION_PAR_RISQUE[d.risque], 0,
    );
    return [LBL_NATURE[n], subset.length, enJeu, provision,
            enJeu > 0 ? `${Math.round((provision * 1000) / enJeu) / 10}%` : '—'];
  });

  return [
    {
      title: 'Synthèse — engagement vs provision',
      columns: ['Indicateur', 'Valeur'],
      rows: [
        ['Dossiers actifs',                actifs.length],
        ['Engagement total (XAF)',         totalEnJeu],
        ['Provision recommandée (XAF)',    Math.round(totalProvision)],
        ['Taux d\'immobilisation',         `${(taux * 100).toFixed(2)}%`],
        ['Seuil réglementaire',            `${(seuilReglementaire * 100).toFixed(2)}%`],
        ['Statut conformité',              taux <= seuilReglementaire
          ? '✅ Conforme' : '❌ Dépassement du seuil — action requise'],
      ],
      note: 'Seuil COBAC indicatif — à confirmer avec la Direction des Risques.',
    },
    {
      title: 'Décomposition par nature de procédure',
      columns: ['Nature', 'Nb dossiers', 'Engagement (XAF)', 'Provision (XAF)', 'Ratio'],
      rows: parNature,
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// 6) Jurisprudence interne annotée
//
// Restitution complète + annotations. Filtre optionnel sur matière.
// ────────────────────────────────────────────────────────────────────────────

export function rapportJurisprudenceInterne(
  entries: JurisprudenceEntry[],
): ExportSection[] {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return [
    {
      title: 'Décisions référencées',
      columns: [
        'Référence', 'Date', 'Juridiction', 'Matière', 'Titre',
        'Mots-clés', 'Résumé', 'Annotations', 'Publiable',
      ],
      rows: sorted.map((j) => [
        j.reference, fmtDate(j.date), j.juridiction, LBL_NATURE[j.matiere],
        j.titre ?? '—', j.motsCles.join(' ; '), j.resume,
        j.annotations ?? '—', j.isPubliable ? 'Oui' : 'Non',
      ]),
      note: `${sorted.length} décision(s) — base interne.`,
    },
    {
      title: 'Répartition par matière',
      columns: ['Matière', 'Nb décisions'],
      rows: (['PENALE', 'SOCIALE', 'CIVILE', 'COMMERCIALE', 'ARBITRALE', 'AUTRE'] as const).map((n) => [
        LBL_NATURE[n], entries.filter((j) => j.matiere === n).length,
      ]),
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Exports auxiliaires — exports « bruts » par entité (liste plate utile aux
// listes de l'app sans passer par les rapports métier).
// ────────────────────────────────────────────────────────────────────────────

export function exportDossiers(dossiers: Dossier[]): ExportSection[] {
  return [{
    title: 'Dossiers',
    columns: ['Réf', 'Intitulé', 'Nature', 'Statut', 'Position', 'Risque',
              'Montant', 'Devise', 'Juridiction', 'Agent', 'Avocat',
              'Ouverture', 'Prochaine échéance', 'Avancement'],
    rows: dossiers.map((d) => [
      d.reference, d.intitule, LBL_NATURE[d.nature], LBL_STATUT_DOSSIER[d.statut],
      LBL_TYPE_ACTION[d.typeAction], LBL_RISQUE[d.risque], d.montantEnJeu, d.devise,
      d.juridiction, d.agent, d.avocat, fmtDate(d.dateOuverture),
      fmtDate(d.prochaineEcheance), `${d.progress}%`,
    ]),
  }];
}

export function exportAudiences(
  audiences: Audience[], dossiers: Dossier[],
): ExportSection[] {
  const refByDossier = new Map(dossiers.map((d) => [d.id, d.reference]));
  return [{
    title: 'Audiences',
    columns: ['Date', 'Heure', 'Dossier', 'Type', 'Objet', 'Juridiction', 'Statut',
              'Issue', 'Agent', 'N° rôle', 'Pièces jointes'],
    rows: audiences.map((a) => [
      fmtDate(a.date), a.heure, refByDossier.get(a.dossierId) ?? a.dossierId,
      a.typeAudience, a.objet, a.juridiction, a.statut, a.issueAudience ?? '—',
      a.agent, a.numeroRole ?? '—', (a.pieces ?? []).length,
    ]),
  }];
}

export function exportDeliberes(
  deliberes: Delibere[], dossiers: Dossier[],
): ExportSection[] {
  const refByDossier = new Map(dossiers.map((d) => [d.id, d.reference]));
  return [{
    title: 'Délibérés',
    columns: ['Dossier', 'Date prévue', 'Date effective', 'Statut', 'Résultat',
              'Montant accordé', 'Voies de recours', 'Recours exercé', 'Grosse levée',
              'Pièces jointes'],
    rows: deliberes.map((d) => [
      refByDossier.get(d.dossierId) ?? d.dossierId,
      fmtDate(d.dateDelibere), fmtDate(d.dateDelibereEffectif),
      LBL_STATUT_DELIBERE[d.statut], d.resultat ? LBL_RESULTAT_DELIBERE[d.resultat] : '—',
      d.montantAccorde ?? 0,
      d.voiesRecours.map((v) => LBL_VOIE_RECOURS[v]).join(' / ') || '—',
      d.recoursExerce ? 'Oui' : 'Non', d.grosseLevee ? 'Oui' : 'Non',
      (d.pieces ?? []).length,
    ]),
  }];
}

export function exportHonoraires(
  honoraires: Honoraire[], dossiers: Dossier[], avocats: Avocat[],
): ExportSection[] {
  const refByDossier = new Map(dossiers.map((d) => [d.id, d.reference]));
  const avocatById = new Map(avocats.map((a) => [a.id, a]));
  return [{
    title: 'Honoraires',
    columns: ['Référence', 'Dossier', 'Avocat', 'Type', 'Facturé', 'Validé',
              'Payé', 'Statut', 'Date facture', 'Date paiement', 'Pièces jointes'],
    rows: honoraires.map((h) => {
      const av = avocatById.get(h.avocatId);
      return [
        h.referenceFacture ?? h.id,
        refByDossier.get(h.dossierId) ?? h.dossierId,
        av ? `${av.prenom ?? ''} ${av.nom}`.trim() : '—',
        h.typeFrais, h.montantFacture, h.montantValide ?? 0, h.montantPaye,
        LBL_STATUT_PAIEMENT[h.statutPaiement],
        fmtDate(h.dateFacture), fmtDate(h.datePaiement),
        (h.pieces ?? []).length,
      ];
    }),
  }];
}
