import { ISSUE_AUDIENCE, STATUT_AUDIENCE, TYPE_AUDIENCE } from '../../../models';
import { LBL_ISSUE_AUDIENCE, LBL_STATUT_AUDIENCE, LBL_TYPE_AUDIENCE } from '../../../labels';
import type { BootstrapData } from '../../../data/source';
import {
  fullName, maybe, pick, pickMaybe, randomDateFR, randomEnumValue, randomHeure, randomInt,
} from './core';

const OBJETS = [
  'Audience au fond — créance impayée',
  'Plaidoiries sur exception de procédure',
  'Mise en état — communication de pièces',
  'Audience de conciliation',
  'Référé — mesure provisoire',
  "Suivi de l'exécution du jugement",
  'Audience de fond — contestation de saisie',
];

export function generateAudienceRows(data: BootstrapData, count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const dossier = pick(data.dossiers, 'dossiers');
    const issue = maybe(randomEnumValue(ISSUE_AUDIENCE, LBL_ISSUE_AUDIENCE));
    rows.push({
      'Référence dossier': dossier.reference,
      'Date': randomDateFR(1, 90),
      'Heure': randomHeure(),
      'Type audience': randomEnumValue(TYPE_AUDIENCE, LBL_TYPE_AUDIENCE),
      'Statut': maybe(randomEnumValue(STATUT_AUDIENCE, LBL_STATUT_AUDIENCE)) ?? '',
      'Juridiction': maybe(dossier.juridiction) ?? '',
      'N° de rôle': maybe(`R-${new Date().getFullYear()}-${randomInt(1000, 9999)}`) ?? '',
      'Salle': maybe(`Salle ${randomInt(1, 12)}`) ?? '',
      'Agent référent': (() => { const a = pickMaybe(data.agents); return a ? fullName(a) : ''; })(),
      'Avocat': (() => { const a = pickMaybe(data.avocats); return a ? fullName(a) : ''; })(),
      'Objet': pick(OBJETS, 'objets'),
      'Compte rendu': '',
      'Issue': issue ?? '',
      'Date renvoi': maybe(randomDateFR(1, 60)) ?? '',
      'Rappel envoyé': pick(['Oui', 'Non'], 'rappel'),
    });
  }
  return rows;
}
