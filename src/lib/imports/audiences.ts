import {
  STATUT_AUDIENCE, TYPE_AUDIENCE, ISSUE_AUDIENCE,
  type StatutAudience, type TypeAudience, type IssueAudience,
} from '../../models';
import {
  LBL_ISSUE_AUDIENCE, LBL_STATUT_AUDIENCE, LBL_TYPE_AUDIENCE,
} from '../../labels';
import type { AudienceInput } from '../../data/source';
import {
  cell, parseBoolean, parseDate, parseEnum,
  resolveAgentId, resolveAvocatId, resolveDossierId,
  type ImportSchema,
} from './common';

/** HH:MM ou HH.MM ou HHhMM → normalisé en HH:MM. */
function parseHeure(raw: string): string | null {
  if (!raw) return null;
  const m = /^(\d{1,2})[h:.](\d{2})/.exec(raw.trim());
  if (!m) return null;
  const h = m[1].padStart(2, '0');
  return `${h}:${m[2]}`;
}

export const AUDIENCES_IMPORT: ImportSchema<AudienceInput> = {
  entityLabel: 'Audiences',
  templateFilename: 'modele-import-audiences.xlsx',
  columns: [
    { label: 'Référence dossier', required: true, example: 'AFB-2025-00123',
      description: 'Référence d\'un dossier déjà enregistré.' },
    { label: 'Date', required: true, example: '15/04/2026' },
    { label: 'Heure', required: true, example: '09:00',
      description: 'Format HH:MM (ou HH.MM, HHhMM).' },
    { label: 'Type audience', required: true, example: 'FOND',
      description: `Parmi : ${TYPE_AUDIENCE.join(', ')}.`, options: TYPE_AUDIENCE },
    { label: 'Statut', example: 'PLANIFIEE',
      description: `Parmi : ${STATUT_AUDIENCE.join(', ')}. Défaut : PLANIFIEE.`, options: STATUT_AUDIENCE },
    { label: 'Juridiction', example: 'Tribunal de Commerce de Douala',
      description: 'Libellé textuel (laisser vide pour reprendre celle du dossier).' },
    { label: 'N° de rôle', example: '2026/CIV/0042' },
    { label: 'Salle', example: 'Salle 3' },
    { label: 'Agent référent', example: 'Pauline MBARGA',
      description: '« Prénom Nom » ou « Nom ». Optionnel.' },
    { label: 'Avocat', example: 'Jean-Pierre NGOUMOU',
      description: '« Prénom Nom » ou « Nom ». Optionnel.' },
    { label: 'Objet', required: true, example: 'Audience au fond — créance impayée' },
    { label: 'Compte rendu', example: '' },
    { label: 'Issue', example: '',
      description: `Optionnel. Parmi : ${ISSUE_AUDIENCE.join(', ')}.`, options: ISSUE_AUDIENCE },
    { label: 'Date renvoi', example: '' },
    { label: 'Rappel envoyé', example: 'Non',
      description: 'Oui/Non — défaut Non.' },
  ],
  parseRow(row, ctx) {
    const errors: string[] = [];

    const refRaw = cell(row, 'Référence dossier');
    const dossierId = resolveDossierId(refRaw, ctx.dossiers);
    if (!refRaw) errors.push('Référence dossier manquante');
    else if (!dossierId) errors.push(`Dossier inconnu : « ${refRaw} »`);

    const date = parseDate(cell(row, 'Date'));
    if (!date) errors.push('Date invalide ou manquante');

    const heure = parseHeure(cell(row, 'Heure'));
    if (!heure) errors.push('Heure invalide ou manquante');

    const typeRaw = cell(row, 'Type audience');
    const typeAudience = parseEnum<TypeAudience>(typeRaw, TYPE_AUDIENCE, LBL_TYPE_AUDIENCE);
    if (!typeAudience) errors.push(`Type audience invalide : « ${typeRaw} »`);

    const statutRaw = cell(row, 'Statut');
    const statut = statutRaw
      ? parseEnum<StatutAudience>(statutRaw, STATUT_AUDIENCE, LBL_STATUT_AUDIENCE)
      : 'PLANIFIEE';
    if (statutRaw && !statut) errors.push(`Statut invalide : « ${statutRaw} »`);

    const objet = cell(row, 'Objet');
    if (!objet || objet.trim().length < 3) errors.push('Objet manquant ou trop court');

    const issueRaw = cell(row, 'Issue');
    const issue = issueRaw
      ? parseEnum<IssueAudience>(issueRaw, ISSUE_AUDIENCE, LBL_ISSUE_AUDIENCE)
      : undefined;
    if (issueRaw && !issue) errors.push(`Issue invalide : « ${issueRaw} »`);

    const agentRaw = cell(row, 'Agent référent');
    const agentId = agentRaw ? resolveAgentId(agentRaw, ctx.agents) : null;
    if (agentRaw && !agentId) errors.push(`Agent inconnu : « ${agentRaw} »`);

    const avocatRaw = cell(row, 'Avocat');
    const avocatId = avocatRaw ? resolveAvocatId(avocatRaw, ctx.avocats) : null;
    if (avocatRaw && !avocatId) errors.push(`Avocat inconnu : « ${avocatRaw} »`);

    if (errors.length) return { input: null, errors };

    // Récupère le dossier pour des valeurs dénormalisées (juridiction, agent).
    const ag = agentId ? ctx.agents.find((a) => a.id === agentId) : null;
    const agLib = ag ? `${ag.prenom ? `${ag.prenom} ` : ''}${ag.nom}` : '';

    const input: AudienceInput = {
      dossierId: dossierId!,
      date: date!,
      heure: heure!,
      statut: statut!,
      typeAudience: typeAudience!,
      juridiction: cell(row, 'Juridiction') || '',
      numeroRole: cell(row, 'N° de rôle') || undefined,
      salleAudience: cell(row, 'Salle') || undefined,
      agentId: agentId ?? undefined,
      agent: agLib,
      avocatId: avocatId ?? undefined,
      objet,
      compteRendu: cell(row, 'Compte rendu') || undefined,
      issueAudience: issue ?? undefined,
      dateRenvoi: cell(row, 'Date renvoi') ? parseDate(cell(row, 'Date renvoi')) ?? undefined : undefined,
      rappelEnvoye: cell(row, 'Rappel envoyé') ? parseBoolean(cell(row, 'Rappel envoyé')) : false,
    };
    return { input, errors: [] };
  },
};