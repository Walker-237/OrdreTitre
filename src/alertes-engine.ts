/**
 * Moteur de génération d'alertes — porté depuis Audience/src/app/services/alertes.service.ts
 * (§ 4.2, 4.3, 4.5 du cahier).
 *
 * Principe : les alertes ne sont **pas stockées**. Elles sont dérivées en
 * continu de l'état des dossiers, audiences, délibérés, honoraires et avocats.
 * L'utilisateur ne peut que **marquer lu** (statut → LUE) ou **écarter**
 * (filtre persistant via `dismissedKeys`). Les deux états sont conservés
 * dans `localStorage` côté store (cf. src/data/store.tsx).
 *
 * 7 déclencheurs :
 *   - RAPPEL_AUDIENCE    : J-7, J-3, J-1, J-0 avant une audience PLANIFIEE
 *   - DELAI_RECOURS      : J-30, J-15, J-7, J-1, J-0 avant expiration recours
 *   - DELIBERE_ATTENDU   : date prévue atteinte sans résultat enregistré
 *   - DOSSIER_INCOMPLET  : dossier actif sans pièce versée
 *   - FRAIS_A_PAYER      : honoraire non payé ni rejeté
 *   - CHARGE_AVOCAT      : avocat dont dossiersActifs ≥ seuilDossiersMax
 *   - INACTIVITE_DOSSIER : pas de mise à jour depuis N jours (désactivé par défaut)
 */
import {
  DELAIS_RECOURS_JOURS,
  type Alerte, type Audience, type Avocat, type Delibere, type Dossier,
  type Honoraire, type NatureProcedure, type TypeAlerte, type VoieRecours,
} from './models';
import { LBL_TYPE_AUDIENCE, formatMontantCourt } from './labels';

export interface RegleConfig {
  type: TypeAlerte;
  declencheur: string;
  actif: boolean;
}

export const REGLES_DEFAUT: RegleConfig[] = [
  { type: 'RAPPEL_AUDIENCE',    declencheur: "J-7, J-3, J-1 avant la date d'audience", actif: true },
  { type: 'DELAI_RECOURS',      declencheur: 'J-30, J-15, J-7, J-1 avant expiration',  actif: true },
  { type: 'DOSSIER_INCOMPLET',  declencheur: 'Pièce obligatoire manquante détectée',   actif: true },
  { type: 'FRAIS_A_PAYER',      declencheur: 'Honoraires en attente de validation',    actif: true },
  { type: 'DELIBERE_ATTENDU',   declencheur: 'Date de délibéré atteinte sans résultat',actif: true },
  { type: 'CHARGE_AVOCAT',      declencheur: 'Seuil de dossiers actifs dépassé',       actif: true },
  { type: 'INACTIVITE_DOSSIER', declencheur: 'Aucune action depuis 30 jours',          actif: false },
];

export interface AlertesInput {
  dossiers: Dossier[];
  audiences: Audience[];
  deliberes: Delibere[];
  avocats: Avocat[];
  honoraires: Honoraire[];
  reglesActives?: Set<TypeAlerte>;
  readKeys?: Set<string>;
  dismissedKeys?: Set<string>;
}

const MAX_ALERTES = 1000;
const INACTIVITE_SEUIL_JOURS = 30;

/**
 * Calcule l'ensemble courant des alertes en fonction de l'état métier.
 * Applique également :
 *   - filtre des alertes écartées (`dismissedKeys`)
 *   - marquage `statut: 'LUE'` pour les clés présentes dans `readKeys`.
 */
export function recomputeAlertes(input: AlertesInput): Alerte[] {
  const reglesActives = input.reglesActives ?? new Set(REGLES_DEFAUT.filter((r) => r.actif).map((r) => r.type));
  const readKeys = input.readKeys ?? new Set<string>();
  const dismissedKeys = input.dismissedKeys ?? new Set<string>();

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);

  const fresh: Array<Omit<Alerte, 'id'> & { _key: string }> = [];
  const seen = new Set<string>();
  const push = (key: string, a: Omit<Alerte, 'id'>) => {
    if (dismissedKeys.has(key)) return;
    if (seen.has(key)) return;
    seen.add(key);
    fresh.push({ ...a, _key: key });
  };

  // ── RAPPEL_AUDIENCE ────────────────────────────────────────────────────────
  if (reglesActives.has('RAPPEL_AUDIENCE')) {
    for (const aud of input.audiences) {
      if (aud.statut !== 'PLANIFIEE') continue;
      const diff = daysBetween(today, aud.date);
      if (Number.isNaN(diff) || diff < 0) continue;
      if (![7, 3, 1, 0].includes(diff)) continue;
      const dossier = input.dossiers.find((d) => d.id === aud.dossierId);
      const dossierRef = dossier?.reference ?? aud.dossierId;
      const key = `RAPPEL_AUDIENCE:${aud.id}:J-${diff}`;
      const sev: 'high' | 'medium' = diff <= 1 ? 'high' : 'medium';
      const msg = `${LBL_TYPE_AUDIENCE[aud.typeAudience] ?? 'Audience'} — ${aud.juridiction} — ${aud.heure || '—'}`;
      push(key, {
        typeAlerte: 'RAPPEL_AUDIENCE',
        severity: sev,
        title: diff === 0 ? "Audience aujourd'hui" : diff === 1 ? 'Audience demain' : `Audience dans ${diff} j`,
        dossier: dossierRef,
        dossierId: aud.dossierId,
        audienceId: aud.id,
        message: msg, desc: msg, due: aud.date,
        canaux: ['EMAIL', 'TEAMS', 'NOTIFICATION_PUSH'],
        statut: 'EN_ATTENTE', nbTentatives: 0,
      });
    }
  }

  // ── DELIBERE_ATTENDU + DELAI_RECOURS ───────────────────────────────────────
  for (const del of input.deliberes) {
    const dossier = input.dossiers.find((d) => d.id === del.dossierId);
    const ref = dossier?.reference ?? del.dossierId;

    if (reglesActives.has('DELIBERE_ATTENDU') && del.statut === 'EN_ATTENTE' &&
        del.dateDelibere && del.dateDelibere <= todayStr) {
      const key = `DELIBERE_ATTENDU:${del.id}`;
      push(key, {
        typeAlerte: 'DELIBERE_ATTENDU', severity: 'high',
        title: 'Délibéré attendu', dossier: ref,
        dossierId: del.dossierId, delibereId: del.id,
        message: 'Date de délibéré atteinte sans résultat enregistré.',
        desc: 'Date de délibéré atteinte sans résultat enregistré.',
        due: del.dateDelibere,
        canaux: ['EMAIL', 'NOTIFICATION_PUSH'],
        statut: 'EN_ATTENTE', nbTentatives: 0,
      });
    }

    if (reglesActives.has('DELAI_RECOURS') && del.statut === 'RENDU' &&
        !del.recoursExerce && del.dateLimiteRecours) {
      const diff = daysBetween(today, del.dateLimiteRecours);
      if (!Number.isNaN(diff) && [30, 15, 7, 1, 0].includes(diff)) {
        const key = `DELAI_RECOURS:${del.id}:J-${diff}`;
        const sev: 'high' | 'medium' = diff <= 7 ? 'high' : 'medium';
        push(key, {
          typeAlerte: 'DELAI_RECOURS', severity: sev,
          title: diff === 0 ? "Délai de recours expire aujourd'hui" : `Recours sous ${diff} j`,
          dossier: ref,
          dossierId: del.dossierId, delibereId: del.id,
          message: `Date limite : ${del.dateLimiteRecours}`,
          desc: `Date limite : ${del.dateLimiteRecours}`,
          due: del.dateLimiteRecours,
          canaux: ['EMAIL', 'TEAMS'],
          statut: 'EN_ATTENTE', nbTentatives: 0,
        });
      }
    }
  }

  // ── DOSSIER_INCOMPLET ──────────────────────────────────────────────────────
  if (reglesActives.has('DOSSIER_INCOMPLET')) {
    for (const d of input.dossiers) {
      if (d.statut === 'CLOTURE' || d.statut === 'ARCHIVE') continue;
      if (d.pieces.length > 0) continue;
      const key = `DOSSIER_INCOMPLET:${d.id}`;
      push(key, {
        typeAlerte: 'DOSSIER_INCOMPLET', severity: 'medium',
        title: 'Dossier sans pièce',
        dossier: d.reference, dossierId: d.id,
        message: 'Aucune pièce de procédure versée au dossier.',
        desc: 'Aucune pièce de procédure versée au dossier.',
        due: todayStr,
        canaux: ['EMAIL', 'NOTIFICATION_PUSH'],
        statut: 'EN_ATTENTE', nbTentatives: 0,
      });
    }
  }

  // ── FRAIS_A_PAYER ──────────────────────────────────────────────────────────
  if (reglesActives.has('FRAIS_A_PAYER')) {
    for (const h of input.honoraires) {
      if (h.statutPaiement === 'PAYE' || h.statutPaiement === 'REJETE') continue;
      const dossier = input.dossiers.find((d) => d.id === h.dossierId);
      const key = `FRAIS_A_PAYER:${h.id}`;
      const msg = `Facture ${h.referenceFacture ?? '—'} : ${formatMontantCourt(h.montantFacture)}`;
      push(key, {
        typeAlerte: 'FRAIS_A_PAYER', severity: 'medium',
        title: 'Honoraire en attente',
        dossier: dossier?.reference ?? h.dossierId,
        dossierId: h.dossierId,
        message: msg, desc: msg,
        due: h.dateFacture,
        canaux: ['EMAIL'],
        statut: 'EN_ATTENTE', nbTentatives: 0,
      });
    }
  }

  // ── CHARGE_AVOCAT ──────────────────────────────────────────────────────────
  if (reglesActives.has('CHARGE_AVOCAT')) {
    for (const av of input.avocats) {
      if (av.dossiersActifs < av.seuilDossiersMax) continue;
      const key = `CHARGE_AVOCAT:${av.id}`;
      const msg = `${av.prenom ? av.prenom + ' ' : ''}${av.nom} : ${av.dossiersActifs}/${av.seuilDossiersMax} dossiers actifs.`;
      push(key, {
        typeAlerte: 'CHARGE_AVOCAT', severity: 'low',
        title: 'Charge avocat dépassée',
        dossier: '—',
        message: msg, desc: msg, due: todayStr,
        canaux: ['EMAIL'],
        statut: 'EN_ATTENTE', nbTentatives: 0,
      });
    }
  }

  // ── INACTIVITE_DOSSIER ─────────────────────────────────────────────────────
  if (reglesActives.has('INACTIVITE_DOSSIER')) {
    for (const d of input.dossiers) {
      if (d.statut === 'CLOTURE' || d.statut === 'ARCHIVE') continue;
      const ref = d.updatedAt ?? d.createdAt ?? d.dateOuverture;
      if (!ref) continue;
      const diff = -daysBetween(today, ref.slice(0, 10));
      if (Number.isNaN(diff) || diff < INACTIVITE_SEUIL_JOURS) continue;
      const key = `INACTIVITE_DOSSIER:${d.id}`;
      const msg = `Aucune mise à jour depuis ${diff} jours.`;
      push(key, {
        typeAlerte: 'INACTIVITE_DOSSIER', severity: 'low',
        title: 'Dossier inactif',
        dossier: d.reference, dossierId: d.id,
        message: msg, desc: msg, due: todayStr,
        canaux: ['EMAIL'],
        statut: 'EN_ATTENTE', nbTentatives: 0,
      });
    }
  }

  // Tri déterministe : sévérité puis date d'échéance puis clé
  fresh.sort((a, b) => {
    const so: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (so[a.severity] - so[b.severity]) ||
           a.due.localeCompare(b.due) ||
           a._key.localeCompare(b._key);
  });

  // Numérotation déterministe + application des marqueurs read/dismissed
  return fresh.slice(0, MAX_ALERTES).map((a, idx) => {
    const isRead = readKeys.has(a._key);
    const { _key, ...rest } = a;
    return {
      ...rest,
      id: idx + 1,
      key: _key,
      statut: isRead ? 'LUE' : 'EN_ATTENTE',
      dateLecture: isRead ? new Date().toISOString() : undefined,
    } as Alerte;
  });
}

/** Clé canonique stable pour une alerte (utilisée par read/dismissed sets). */
export function derivedKey(a: Alerte): string {
  if (a.typeAlerte === 'RAPPEL_AUDIENCE' && a.audienceId) return `RAPPEL_AUDIENCE:${a.audienceId}:${a.due}`;
  if (a.typeAlerte === 'DELAI_RECOURS' && a.delibereId)  return `DELAI_RECOURS:${a.delibereId}:${a.due}`;
  if (a.typeAlerte === 'DELIBERE_ATTENDU' && a.delibereId) return `DELIBERE_ATTENDU:${a.delibereId}`;
  if (a.typeAlerte === 'DOSSIER_INCOMPLET' && a.dossierId) return `DOSSIER_INCOMPLET:${a.dossierId}`;
  if (a.typeAlerte === 'CHARGE_AVOCAT')                   return `CHARGE_AVOCAT:${a.dossier}`;
  if (a.typeAlerte === 'FRAIS_A_PAYER' && a.dossierId)    return `FRAIS_A_PAYER:${a.dossier}:${a.due}`;
  if (a.typeAlerte === 'INACTIVITE_DOSSIER' && a.dossierId) return `INACTIVITE_DOSSIER:${a.dossierId}`;
  return `${a.typeAlerte}:${a.dossier}:${a.due}`;
}

function daysBetween(today: Date, isoDate: string): number {
  if (!isoDate) return Number.NaN;
  const t = new Date(isoDate);
  if (Number.isNaN(t.getTime())) return Number.NaN;
  return Math.round((t.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Calcule la date limite de recours selon la matière et la voie (§ 4.3).
 * Renvoie undefined si la matière/voie n'a pas de délai configuré.
 */
export function dateLimiteRecours(
  dateDelibereEffectif: string,
  matiere: NatureProcedure,
  voie: VoieRecours,
): string | undefined {
  if (!dateDelibereEffectif || voie === 'AUCUNE') return undefined;
  const cle = `${voie}_${matiere}`;
  const jours = DELAIS_RECOURS_JOURS[cle]
    ?? (voie === 'TIERCE_OPPOSITION' ? DELAIS_RECOURS_JOURS['TIERCE_OPPOSITION_DEFAULT'] : undefined)
    ?? (voie === 'OPPOSITION'        ? DELAIS_RECOURS_JOURS['OPPOSITION_DEFAULT']        : undefined);
  if (typeof jours !== 'number') return undefined;
  const t = new Date(dateDelibereEffectif);
  if (Number.isNaN(t.getTime())) return undefined;
  t.setDate(t.getDate() + jours);
  return t.toISOString().slice(0, 10);
}
