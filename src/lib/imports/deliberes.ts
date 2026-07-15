import {
  RESULTAT_DELIBERE, STATUT_DELIBERE, VOIE_RECOURS,
  type ResultatDelibere, type StatutDelibere, type VoieRecours,
} from '../../models';
import {
  LBL_RESULTAT_DELIBERE, LBL_STATUT_DELIBERE, LBL_VOIE_RECOURS,
} from '../../labels';
import type { DelibereInput } from '../../data/source';
import {
  cell, parseBoolean, parseDate, parseEnum, parseNumber,
  resolveDossierId, type ImportSchema,
} from './common';

export const DELIBERES_IMPORT: ImportSchema<DelibereInput> = {
  entityLabel: 'Délibérés',
  templateFilename: 'modele-import-deliberes.xlsx',
  columns: [
    { label: 'Référence dossier', required: true, example: 'AFB-2025-00123',
      description: 'Référence d\'un dossier déjà enregistré.' },
    { label: 'Date prévue', required: true, example: '15/05/2026' },
    { label: 'Date effective', example: '15/05/2026',
      description: 'Optionnel : à renseigner une fois le délibéré rendu.' },
    { label: 'Statut', example: 'EN_ATTENTE',
      description: `Parmi : ${STATUT_DELIBERE.join(', ')}. Défaut : EN_ATTENTE.` },
    { label: 'Résultat', example: '',
      description: `Optionnel. Parmi : ${RESULTAT_DELIBERE.join(', ')}.` },
    { label: 'Montant accordé', example: '' },
    { label: 'Montant condamné', example: '' },
    { label: 'Voies de recours', example: 'APPEL, OPPOSITION',
      description: `Liste séparée par virgules — parmi : ${VOIE_RECOURS.join(', ')}.` },
    { label: 'Recours exercé', example: 'Non',
      description: 'Oui/Non — défaut Non.' },
    { label: 'Grosse levée', example: 'Non',
      description: 'Oui/Non — défaut Non.' },
    { label: 'Dispositif', example: '' },
    { label: 'Observations', example: '' },
  ],
  parseRow(row, ctx) {
    const errors: string[] = [];

    const refRaw = cell(row, 'Référence dossier');
    const dossierId = resolveDossierId(refRaw, ctx.dossiers);
    if (!refRaw) errors.push('Référence dossier manquante');
    else if (!dossierId) errors.push(`Dossier inconnu : « ${refRaw} »`);

    const datePrevue = parseDate(cell(row, 'Date prévue'));
    if (!datePrevue) errors.push('Date prévue invalide ou manquante');

    const dateEffectiveRaw = cell(row, 'Date effective');
    const dateEffective = dateEffectiveRaw ? parseDate(dateEffectiveRaw) : null;
    if (dateEffectiveRaw && !dateEffective) errors.push(`Date effective invalide : « ${dateEffectiveRaw} »`);

    const statutRaw = cell(row, 'Statut');
    const statut = statutRaw
      ? parseEnum<StatutDelibere>(statutRaw, STATUT_DELIBERE, LBL_STATUT_DELIBERE)
      : 'EN_ATTENTE';
    if (statutRaw && !statut) errors.push(`Statut invalide : « ${statutRaw} »`);

    const resRaw = cell(row, 'Résultat');
    const resultat = resRaw
      ? parseEnum<ResultatDelibere>(resRaw, RESULTAT_DELIBERE, LBL_RESULTAT_DELIBERE)
      : undefined;
    if (resRaw && !resultat) errors.push(`Résultat invalide : « ${resRaw} »`);

    const accordeRaw = cell(row, 'Montant accordé');
    const montantAccorde = accordeRaw ? parseNumber(accordeRaw) : undefined;
    if (accordeRaw && montantAccorde == null) errors.push(`Montant accordé invalide : « ${accordeRaw} »`);

    const condRaw = cell(row, 'Montant condamné');
    const montantCondamne = condRaw ? parseNumber(condRaw) : undefined;
    if (condRaw && montantCondamne == null) errors.push(`Montant condamné invalide : « ${condRaw} »`);

    const voiesRaw = cell(row, 'Voies de recours');
    const voies: VoieRecours[] = [];
    if (voiesRaw) {
      for (const part of voiesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
        const v = parseEnum<VoieRecours>(part, VOIE_RECOURS, LBL_VOIE_RECOURS);
        if (!v) { errors.push(`Voie de recours inconnue : « ${part} »`); continue; }
        voies.push(v);
      }
    }

    if (errors.length) return { input: null, errors };

    const input: DelibereInput = {
      dossierId: dossierId!,
      dateDelibere: datePrevue!,
      dateDelibereEffectif: dateEffective ?? undefined,
      statut: statut!,
      resultat: resultat ?? undefined,
      montantAccorde: montantAccorde ?? undefined,
      montantCondamne: montantCondamne ?? undefined,
      voiesRecours: voies,
      recoursExerce: cell(row, 'Recours exercé') ? parseBoolean(cell(row, 'Recours exercé')) : false,
      grosseLevee: cell(row, 'Grosse levée') ? parseBoolean(cell(row, 'Grosse levée')) : false,
      dispositif: cell(row, 'Dispositif') || undefined,
      observations: cell(row, 'Observations') || undefined,
    };
    return { input, errors: [] };
  },
};
