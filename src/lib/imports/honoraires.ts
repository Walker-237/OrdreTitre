import {
  STATUT_PAIEMENT, TYPE_FRAIS,
  type StatutPaiement, type TypeFrais,
} from '../../models';
import { LBL_STATUT_PAIEMENT, LBL_TYPE_FRAIS } from '../../labels';
import type { HonoraireInput } from '../../data/source';
import {
  cell, parseDate, parseEnum, parseNumber,
  resolveAvocatId, resolveDossierId,
  type ImportSchema,
} from './common';

export const HONORAIRES_IMPORT: ImportSchema<HonoraireInput> = {
  entityLabel: 'Honoraires',
  templateFilename: 'modele-import-honoraires.xlsx',
  columns: [
    { label: 'Référence dossier', required: true, example: 'AFB-2025-00123' },
    { label: 'Avocat', required: true, example: 'Jean-Pierre NGOUMOU',
      description: '« Prénom Nom » ou « Nom » d\'un avocat enregistré.' },
    { label: 'Référence facture', example: 'FAC-2026-042' },
    { label: 'Type de frais', required: true, example: 'HONORAIRES',
      description: `Parmi : ${TYPE_FRAIS.join(', ')}.` },
    { label: 'Montant facturé', required: true, example: '1500000' },
    { label: 'Montant validé', example: '' },
    { label: 'Montant payé', example: '0' },
    { label: 'Statut paiement', example: 'EN_ATTENTE',
      description: `Parmi : ${STATUT_PAIEMENT.join(', ')}. Défaut : EN_ATTENTE.` },
    { label: 'Date facture', required: true, example: '15/03/2026' },
    { label: 'Date validation', example: '' },
    { label: 'Date paiement', example: '' },
    { label: 'Observations', example: '' },
  ],
  parseRow(row, ctx) {
    const errors: string[] = [];

    const dRef = cell(row, 'Référence dossier');
    const dossierId = resolveDossierId(dRef, ctx.dossiers);
    if (!dRef) errors.push('Référence dossier manquante');
    else if (!dossierId) errors.push(`Dossier inconnu : « ${dRef} »`);

    const aRef = cell(row, 'Avocat');
    const avocatId = resolveAvocatId(aRef, ctx.avocats);
    if (!aRef) errors.push('Avocat manquant');
    else if (!avocatId) errors.push(`Avocat inconnu : « ${aRef} »`);

    const typeRaw = cell(row, 'Type de frais');
    const typeFrais = parseEnum<TypeFrais>(typeRaw, TYPE_FRAIS, LBL_TYPE_FRAIS);
    if (!typeFrais) errors.push(`Type de frais invalide : « ${typeRaw} »`);

    const factRaw = cell(row, 'Montant facturé');
    const montantFacture = parseNumber(factRaw);
    if (montantFacture == null || montantFacture <= 0) errors.push(`Montant facturé invalide : « ${factRaw} »`);

    const validRaw = cell(row, 'Montant validé');
    const montantValide = validRaw ? parseNumber(validRaw) : undefined;
    if (validRaw && montantValide == null) errors.push(`Montant validé invalide : « ${validRaw} »`);

    const payeRaw = cell(row, 'Montant payé');
    const montantPaye = payeRaw ? parseNumber(payeRaw) : 0;
    if (payeRaw && montantPaye == null) errors.push(`Montant payé invalide : « ${payeRaw} »`);

    const statutRaw = cell(row, 'Statut paiement');
    const statutPaiement = statutRaw
      ? parseEnum<StatutPaiement>(statutRaw, STATUT_PAIEMENT, LBL_STATUT_PAIEMENT)
      : 'EN_ATTENTE';
    if (statutRaw && !statutPaiement) errors.push(`Statut paiement invalide : « ${statutRaw} »`);

    const dateFacture = parseDate(cell(row, 'Date facture'));
    if (!dateFacture) errors.push('Date facture invalide ou manquante');

    const dValRaw = cell(row, 'Date validation');
    const dateValidation = dValRaw ? parseDate(dValRaw) : null;
    if (dValRaw && !dateValidation) errors.push(`Date validation invalide : « ${dValRaw} »`);

    const dPayRaw = cell(row, 'Date paiement');
    const datePaiement = dPayRaw ? parseDate(dPayRaw) : null;
    if (dPayRaw && !datePaiement) errors.push(`Date paiement invalide : « ${dPayRaw} »`);

    if (errors.length) return { input: null, errors };

    const input: HonoraireInput = {
      dossierId: dossierId!,
      avocatId: avocatId!,
      referenceFacture: cell(row, 'Référence facture') || undefined,
      typeFrais: typeFrais!,
      montantFacture: montantFacture!,
      montantValide: montantValide ?? undefined,
      montantPaye: montantPaye ?? 0,
      statutPaiement: statutPaiement!,
      dateFacture: dateFacture!,
      dateValidation: dateValidation ?? undefined,
      datePaiement: datePaiement ?? undefined,
      observations: cell(row, 'Observations') || undefined,
    };
    return { input, errors: [] };
  },
};
