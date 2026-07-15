import type { AvocatInput } from '../../data/source';
import {
  cell, parseBoolean, parseDate, parseNumber, type ImportSchema,
} from './common';

export const AVOCATS_IMPORT: ImportSchema<AvocatInput> = {
  entityLabel: 'Avocats',
  templateFilename: 'modele-import-avocats.xlsx',
  columns: [
    { label: 'Nom', required: true, example: 'NGOUMOU' },
    { label: 'Prénom', example: 'Jean-Pierre' },
    { label: 'Cabinet', required: true, example: 'Cabinet Ngoumou & Associés' },
    { label: 'N° barreau', example: '00345' },
    { label: 'Barreau', example: 'Barreau du Cameroun' },
    { label: 'Spécialités', example: 'Bancaire, Recouvrement',
      description: 'Liste séparée par virgules.' },
    { label: 'Téléphone', required: true, example: '+237 699 00 00 00' },
    { label: 'Téléphone secondaire', example: '+237 233 42 00 00' },
    { label: 'Email', required: true, example: 'contact@cabinet-ngoumou.test' },
    { label: 'Adresse', example: 'Bonanjo' },
    { label: 'Ville', required: true, example: 'Douala' },
    { label: 'Seuil dossiers max', example: '20',
      description: 'Nombre maximum de dossiers actifs ; défaut 20.' },
    { label: 'Taux', example: '350000',
      description: 'Taux horaire ou journalier en devise locale.' },
    { label: 'Honoraires', example: '0' },
    { label: 'Actif', example: 'Oui', description: 'Oui/Non — défaut Oui.' },
    { label: 'Date début collaboration', example: '01/01/2024',
      description: 'Format JJ/MM/AAAA ou AAAA-MM-JJ.' },
    { label: 'Notes', example: '' },
  ],
  parseRow(row) {
    const errors: string[] = [];
    const nom = cell(row, 'Nom');
    if (!nom) errors.push('Nom manquant');
    const cabinet = cell(row, 'Cabinet');
    if (!cabinet) errors.push('Cabinet manquant');
    const telephone = cell(row, 'Téléphone');
    if (!telephone) errors.push('Téléphone manquant');
    const email = cell(row, 'Email');
    if (!email) errors.push('Email manquant');
    const ville = cell(row, 'Ville');
    if (!ville) errors.push('Ville manquante');

    const seuilRaw = cell(row, 'Seuil dossiers max');
    const seuil = seuilRaw ? parseNumber(seuilRaw) : 20;
    if (seuilRaw && seuil == null) errors.push(`Seuil invalide : « ${seuilRaw} »`);

    const tauxRaw = cell(row, 'Taux');
    const taux = tauxRaw ? parseNumber(tauxRaw) : 0;
    if (tauxRaw && taux == null) errors.push(`Taux invalide : « ${tauxRaw} »`);

    const honosRaw = cell(row, 'Honoraires');
    const honoraires = honosRaw ? parseNumber(honosRaw) : 0;
    if (honosRaw && honoraires == null) errors.push(`Honoraires invalides : « ${honosRaw} »`);

    if (errors.length) return { input: null, errors };
    const specRaw = cell(row, 'Spécialités');
    const input: AvocatInput = {
      nom, prenom: cell(row, 'Prénom') || undefined, cabinet,
      numeroBarreau: cell(row, 'N° barreau') || undefined,
      barreau: cell(row, 'Barreau') || undefined,
      specialites: specRaw ? specRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
      telephone, email, ville,
      telephoneSecondaire: cell(row, 'Téléphone secondaire') || undefined,
      adresse: cell(row, 'Adresse') || undefined,
      seuilDossiersMax: seuil ?? 20,
      dossiersActifs: 0,
      taux: taux ?? 0,
      honoraires: honoraires ?? 0,
      isActive: cell(row, 'Actif') ? parseBoolean(cell(row, 'Actif')) : true,
      dateDebutCollaboration: cell(row, 'Date début collaboration')
        ? parseDate(cell(row, 'Date début collaboration')) ?? undefined : undefined,
      notes: cell(row, 'Notes') || undefined,
    };
    return { input, errors: [] };
  },
};
