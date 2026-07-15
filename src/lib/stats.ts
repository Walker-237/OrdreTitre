/**
 * Helpers de comptage live pour les intervenants (avocats / agents).
 *
 * Les champs stockés `Avocat.dossiersActifs`, `Agent.dossiers`, `Agent.audiences`
 * sont des snapshots — ils peuvent se désynchroniser dès qu'un dossier change
 * d'avocat ou de statut. Ces helpers recalculent à la volée à partir des
 * collections du store, garantissant l'exactitude au moment du rendu.
 */
import type { Audience, Dossier } from '../models';

/**
 * Comptes des dossiers d'un avocat.
 *
 *   - actifs   : dossier dont statut ∉ {CLOTURE, ARCHIVE}
 *   - inactifs : dossier dont statut ∈ {CLOTURE, ARCHIVE}
 *   - total    : actifs + inactifs (utile pour l'affichage)
 *
 * Le rapprochement se fait par `dossier.avocatId`. Si le dossier n'a qu'un
 * libellé avocat (champ `avocat`), il est ignoré — seul l'id compte (pour
 * éviter les ambiguïtés sur des noms homonymes).
 */
export interface AvocatCounts {
  dossiersActifs: number;
  dossiersInactifs: number;
  dossiersTotal: number;
  audiencesAVenir: number;
  audiencesPassees: number;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function getAvocatCounts(
  avocatId: string, dossiers: Dossier[], audiences: Audience[],
): AvocatCounts {
  const lies = dossiers.filter((d) => d.avocatId === avocatId);
  const dossiersActifs   = lies.filter((d) => d.statut !== 'CLOTURE' && d.statut !== 'ARCHIVE').length;
  const dossiersInactifs = lies.length - dossiersActifs;
  const now = todayIso();
  const audiencesLiees = audiences.filter((a) => a.avocatId === avocatId);
  return {
    dossiersActifs,
    dossiersInactifs,
    dossiersTotal: lies.length,
    audiencesAVenir: audiencesLiees.filter((a) => a.date >= now).length,
    audiencesPassees: audiencesLiees.filter((a) => a.date < now).length,
  };
}

export interface AgentCounts {
  dossiersActifs: number;
  dossiersInactifs: number;
  dossiersTotal: number;
  audiencesAVenir: number;
  audiencesPassees: number;
}

export function getAgentCounts(
  agentId: string, dossiers: Dossier[], audiences: Audience[],
): AgentCounts {
  const lies = dossiers.filter((d) => d.agentId === agentId);
  const dossiersActifs   = lies.filter((d) => d.statut !== 'CLOTURE' && d.statut !== 'ARCHIVE').length;
  const dossiersInactifs = lies.length - dossiersActifs;
  const now = todayIso();
  const audiencesLiees = audiences.filter((a) => a.agentId === agentId);
  return {
    dossiersActifs,
    dossiersInactifs,
    dossiersTotal: lies.length,
    audiencesAVenir: audiencesLiees.filter((a) => a.date >= now).length,
    audiencesPassees: audiencesLiees.filter((a) => a.date < now).length,
  };
}

/**
 * Niveau de saturation d'un avocat en fonction de sa charge et de son seuil.
 * Identique à la logique du rapport « Doublons & charge avocats ».
 */
export type ChargeLevel = 'OK' | 'TENDU' | 'SATURE';

export function chargeLevel(actifs: number, seuil: number): ChargeLevel {
  if (seuil <= 0) return 'OK';
  const pct = (actifs * 100) / seuil;
  if (pct >= 100) return 'SATURE';
  if (pct >= 80)  return 'TENDU';
  return 'OK';
}

export const CHARGE_LABEL: Record<ChargeLevel, string> = {
  OK: 'OK',
  TENDU: 'Tendu',
  SATURE: 'Saturé',
};
export const CHARGE_PILL: Record<ChargeLevel, string> = {
  OK: 'green',
  TENDU: 'orange',
  SATURE: 'red',
};
