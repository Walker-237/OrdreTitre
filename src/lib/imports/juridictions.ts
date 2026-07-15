import {
  NIVEAU_JURIDICTION, TYPE_JURIDICTION,
  type NiveauJuridiction, type TypeJuridiction,
} from '../../models';
import { LBL_NIVEAU_JURIDICTION, LBL_TYPE_JURIDICTION } from '../../labels';
import type { JuridictionInput } from '../../data/source';
import {
  cell, parseBoolean, parseEnum, type ImportSchema,
} from './common';

export const JURIDICTIONS_IMPORT: ImportSchema<JuridictionInput> = {
  entityLabel: 'Juridictions',
  templateFilename: 'modele-import-juridictions.xlsx',
  columns: [
    { label: 'Libellé', required: true, example: 'Tribunal de Commerce de Douala',
      description: 'Nom complet de la juridiction.' },
    { label: 'Type', required: true, example: 'TRIBUNAL_COMMERCE',
      description: `Code ou libellé parmi : ${TYPE_JURIDICTION.join(', ')}.` },
    { label: 'Niveau', required: true, example: 'PREMIER_DEGRE',
      description: `Code ou libellé parmi : ${NIVEAU_JURIDICTION.join(', ')}.` },
    { label: 'Ville', required: true, example: 'Douala' },
    { label: 'Pays', required: true, example: 'Cameroun' },
    { label: 'Adresse', example: 'Bonanjo, BP 1234' },
    { label: 'Téléphone', example: '+237 233 42 00 00' },
    { label: 'Email greffe', example: 'greffe@trib-cmr.test' },
    { label: 'Actif', example: 'Oui', description: 'Oui/Non. Par défaut : Oui.' },
    { label: 'Notes', example: '' },
  ],
  parseRow(row) {
    const errors: string[] = [];
    const libelle = cell(row, 'Libellé');
    if (!libelle) errors.push('Libellé manquant');
    const typeRaw = cell(row, 'Type');
    const type = parseEnum<TypeJuridiction>(typeRaw, TYPE_JURIDICTION, LBL_TYPE_JURIDICTION);
    if (!type) errors.push(`Type invalide : « ${typeRaw} »`);
    const niveauRaw = cell(row, 'Niveau');
    const niveau = parseEnum<NiveauJuridiction>(niveauRaw, NIVEAU_JURIDICTION, LBL_NIVEAU_JURIDICTION);
    if (!niveau) errors.push(`Niveau invalide : « ${niveauRaw} »`);
    const ville = cell(row, 'Ville');
    if (!ville) errors.push('Ville manquante');
    const pays = cell(row, 'Pays');
    if (!pays) errors.push('Pays manquant');

    if (errors.length) return { input: null, errors };
    const input: JuridictionInput = {
      libelle, typeJuridiction: type!, niveau: niveau!, ville, pays,
      adresse: cell(row, 'Adresse') || undefined,
      telephone: cell(row, 'Téléphone') || undefined,
      emailGreffe: cell(row, 'Email greffe') || undefined,
      isActive: cell(row, 'Actif') ? parseBoolean(cell(row, 'Actif')) : true,
      notes: cell(row, 'Notes') || undefined,
    };
    return { input, errors: [] };
  },
};
