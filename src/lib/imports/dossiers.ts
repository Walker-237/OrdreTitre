import {
  NATURE_PROCEDURE, RISQUE, STATUT_DOSSIER, TYPE_ACTION,
  type NatureProcedure, type RisqueLevel, type StatutDossier, type TypeAction,
} from '../../models';
import {
  LBL_NATURE, LBL_RISQUE, LBL_STATUT_DOSSIER, LBL_TYPE_ACTION,
} from '../../labels';
import type { DossierInput } from '../../data/source';
import {
  cell, parseDate, parseEnum, parseNumber,
  resolveAgentId, resolveAvocatId, resolveJuridictionId,
  type ImportSchema,
} from './common';

export const DOSSIERS_IMPORT: ImportSchema<DossierInput> = {
  entityLabel: 'Dossiers',
  templateFilename: 'modele-import-dossiers.xlsx',
  columns: [
    { label: 'Référence', example: 'AFB-2026-00042',
      description: 'Optionnel : laissez vide pour une numérotation automatique.' },
    { label: 'Intitulé', required: true, example: 'AFB c/ SARL EXEMPLE' },
    { label: 'Nature', required: true, example: 'COMMERCIALE',
      description: `Parmi : ${NATURE_PROCEDURE.join(', ')}.` },
    { label: 'Sous-nature', required: true, example: 'Recouvrement créance' },
    { label: 'Type action', required: true, example: 'DEMANDEUR',
      description: `Parmi : ${TYPE_ACTION.join(', ')}.` },
    { label: 'Juridiction', required: true, example: 'Tribunal de Commerce de Douala',
      description: 'Libellé exact d\'une juridiction déjà enregistrée.' },
    { label: 'Ville', required: true, example: 'Douala' },
    { label: 'Montant en jeu', required: true, example: '15000000',
      description: 'Nombre — séparateurs autorisés : espace, virgule.' },
    { label: 'Devise', required: true, example: 'XAF' },
    { label: 'Statut', example: 'OUVERT',
      description: `Parmi : ${STATUT_DOSSIER.join(', ')}. Défaut : OUVERT.` },
    { label: 'Agent référent', required: true, example: 'Pauline MBARGA',
      description: '« Prénom Nom » ou « Nom » d\'un agent enregistré.' },
    { label: 'Avocat mandaté', example: 'Jean-Pierre NGOUMOU',
      description: '« Prénom Nom » ou « Nom » d\'un avocat enregistré (optionnel).' },
    { label: 'Date ouverture', required: true, example: '01/03/2026' },
    { label: 'Prochaine échéance', required: true, example: '15/04/2026' },
    { label: 'Progression %', example: '0',
      description: 'Pourcentage 0-100. Défaut : 0.' },
    { label: 'Risque', example: 'MOYEN',
      description: `Parmi : ${RISQUE.join(', ')}. Défaut : MOYEN.` },
    { label: 'Résumé des faits', example: '' },
    { label: 'Observations', example: '' },
  ],
  parseRow(row, ctx) {
    const errors: string[] = [];

    const intitule = cell(row, 'Intitulé');
    if (!intitule) errors.push('Intitulé manquant');

    const natureRaw = cell(row, 'Nature');
    const nature = parseEnum<NatureProcedure>(natureRaw, NATURE_PROCEDURE, LBL_NATURE);
    if (!nature) errors.push(`Nature invalide : « ${natureRaw} »`);

    const sousNature = cell(row, 'Sous-nature');
    if (!sousNature) errors.push('Sous-nature manquante');

    const typeRaw = cell(row, 'Type action');
    const typeAction = parseEnum<TypeAction>(typeRaw, TYPE_ACTION, LBL_TYPE_ACTION);
    if (!typeAction) errors.push(`Type action invalide : « ${typeRaw} »`);

    const juRaw = cell(row, 'Juridiction');
    const juridictionId = resolveJuridictionId(juRaw, ctx.juridictions);
    if (juRaw && !juridictionId) errors.push(`Juridiction inconnue : « ${juRaw} »`);
    if (!juRaw) errors.push('Juridiction manquante');

    const ville = cell(row, 'Ville');
    if (!ville) errors.push('Ville manquante');

    const montantRaw = cell(row, 'Montant en jeu');
    const montant = parseNumber(montantRaw);
    if (montant == null) errors.push(`Montant invalide : « ${montantRaw} »`);

    const devise = cell(row, 'Devise');
    if (!devise) errors.push('Devise manquante');

    const statutRaw = cell(row, 'Statut');
    const statut = statutRaw
      ? parseEnum<StatutDossier>(statutRaw, STATUT_DOSSIER, LBL_STATUT_DOSSIER)
      : 'OUVERT';
    if (statutRaw && !statut) errors.push(`Statut invalide : « ${statutRaw} »`);

    const agentRaw = cell(row, 'Agent référent');
    const agentId = resolveAgentId(agentRaw, ctx.agents);
    if (agentRaw && !agentId) errors.push(`Agent inconnu : « ${agentRaw} »`);
    if (!agentRaw) errors.push('Agent référent manquant');

    const avocatRaw = cell(row, 'Avocat mandaté');
    const avocatId = avocatRaw ? resolveAvocatId(avocatRaw, ctx.avocats) : null;
    if (avocatRaw && !avocatId) errors.push(`Avocat inconnu : « ${avocatRaw} »`);

    const dateOuv = parseDate(cell(row, 'Date ouverture'));
    if (!dateOuv) errors.push('Date d\'ouverture invalide ou manquante');

    const echeance = parseDate(cell(row, 'Prochaine échéance'));
    if (!echeance) errors.push('Prochaine échéance invalide ou manquante');

    const progRaw = cell(row, 'Progression %');
    const progress = progRaw ? parseNumber(progRaw) : 0;
    if (progRaw && progress == null) errors.push(`Progression invalide : « ${progRaw} »`);

    const risqueRaw = cell(row, 'Risque');
    const risque = risqueRaw
      ? parseEnum<RisqueLevel>(risqueRaw, RISQUE, LBL_RISQUE)
      : 'MOYEN';
    if (risqueRaw && !risque) errors.push(`Risque invalide : « ${risqueRaw} »`);

    if (errors.length) return { input: null, errors };

    // Libellés affichables (juridiction / agent / avocat) pour les colonnes
    // dénormalisées Dossier.juridiction / .agent / .avocat.
    const jurLib = ctx.juridictions.find((j) => j.id === juridictionId)?.libelle ?? '';
    const ag = ctx.agents.find((a) => a.id === agentId);
    const agLib = ag ? `${ag.prenom ? `${ag.prenom} ` : ''}${ag.nom}` : '';
    const av = avocatId ? ctx.avocats.find((a) => a.id === avocatId) : null;
    const avLib = av ? `${av.prenom ? `${av.prenom} ` : ''}${av.nom}` : '';

    const input: DossierInput = {
      reference: cell(row, 'Référence') || undefined,
      intitule,
      nature: nature!,
      sousNature,
      typeAction: typeAction!,
      juridictionId: juridictionId!,
      juridiction: jurLib,
      ville,
      montantEnJeu: montant!,
      devise: devise.toUpperCase(),
      statut: statut!,
      agentId: agentId!,
      agent: agLib,
      avocatId: avocatId ?? undefined,
      avocat: avLib,
      dateOuverture: dateOuv!,
      prochaineEcheance: echeance!,
      progress: Math.max(0, Math.min(100, progress ?? 0)),
      risque: risque!,
      resumeFaits: cell(row, 'Résumé des faits') || undefined,
      observations: cell(row, 'Observations') || undefined,
      parties: [],
      pieces: [],
    };
    return { input, errors: [] };
  },
};
