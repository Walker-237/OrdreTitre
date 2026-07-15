import type { AgentInput } from '../../data/source';
import {
  cell, parseBoolean, parseDate, parseNumber, type ImportSchema,
} from './common';

export const AGENTS_IMPORT: ImportSchema<AgentInput> = {
  entityLabel: 'Agents',
  templateFilename: 'modele-import-agents.xlsx',
  columns: [
    { label: 'Matricule', example: 'AFB-2024-001' },
    { label: 'Nom', required: true, example: 'MBARGA' },
    { label: 'Prénom', example: 'Pauline' },
    { label: 'Poste', required: true, example: 'Juriste senior' },
    { label: 'Fonction', required: true, example: 'Suivi contentieux' },
    { label: 'Direction', required: true, example: 'DAJ',
      description: 'Code direction interne (DAJ, DRI, DSI, GFC, DRB, AUTRE).' },
    { label: 'Téléphone', required: true, example: '+237 699 11 22 33' },
    { label: 'Email', required: true, example: 'p.mbarga@afrilandfirstbank.test' },
    { label: 'Taux', example: '0', description: 'Taux interne (optionnel).' },
    { label: 'Actif', example: 'Oui', description: 'Oui/Non — défaut Oui.' },
    { label: 'Date prise de fonction', example: '01/06/2022' },
    { label: 'Notes', example: '' },
  ],
  parseRow(row) {
    const errors: string[] = [];
    const nom = cell(row, 'Nom');           if (!nom) errors.push('Nom manquant');
    const poste = cell(row, 'Poste');       if (!poste) errors.push('Poste manquant');
    const fonction = cell(row, 'Fonction'); if (!fonction) errors.push('Fonction manquante');
    const direction = cell(row, 'Direction'); if (!direction) errors.push('Direction manquante');
    const telephone = cell(row, 'Téléphone'); if (!telephone) errors.push('Téléphone manquant');
    const email = cell(row, 'Email');       if (!email) errors.push('Email manquant');

    const tauxRaw = cell(row, 'Taux');
    const taux = tauxRaw ? parseNumber(tauxRaw) : 0;
    if (tauxRaw && taux == null) errors.push(`Taux invalide : « ${tauxRaw} »`);

    if (errors.length) return { input: null, errors };
    const input: AgentInput = {
      matricule: cell(row, 'Matricule') || undefined,
      nom, prenom: cell(row, 'Prénom') || undefined,
      poste, fonction, direction, telephone, email,
      dossiers: 0, audiences: 0,
      taux: taux ?? 0,
      isActive: cell(row, 'Actif') ? parseBoolean(cell(row, 'Actif')) : true,
      datePriseFonction: cell(row, 'Date prise de fonction')
        ? parseDate(cell(row, 'Date prise de fonction')) ?? undefined : undefined,
      notes: cell(row, 'Notes') || undefined,
    };
    return { input, errors: [] };
  },
};
