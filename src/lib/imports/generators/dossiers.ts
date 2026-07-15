import { NATURE_PROCEDURE, RISQUE, STATUT_DOSSIER, TYPE_ACTION } from '../../../models';
import { LBL_NATURE, LBL_RISQUE, LBL_STATUT_DOSSIER, LBL_TYPE_ACTION } from '../../../labels';
import type { BootstrapData } from '../../../data/source';
import {
  fullName, maybe, pick, pickMaybe, randomDateFR, randomEnumValue, randomInt,
} from './core';

const INTITULES = [
  'AFB c/ Sté EXEMPLE SARL — Recouvrement crédit',
  'AFB c/ MBALLA Joseph — Compte débiteur',
  'AFB c/ Sté TRANS-CAMEROUN — Résiliation de bail commercial',
  'NGONO Béatrice c/ AFB — Contestation de frais bancaires',
  'AFB c/ GROUPE SOTRACO — Exécution de garantie',
];
const SOUS_NATURES = [
  "Inexécution d'obligations contractuelles", 'Recouvrement de créance',
  'Exécution forcée', 'Action en restitution', 'Indemnités',
];

export function generateDossierRows(data: BootstrapData, count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const juridiction = pick(data.juridictions, 'juridictions');
    const agent = pick(data.agents, 'agents');
    const avocat = pickMaybe(data.avocats);
    rows.push({
      'Référence': '',
      'Intitulé': pick(INTITULES, 'intitulés'),
      'Nature': randomEnumValue(NATURE_PROCEDURE, LBL_NATURE),
      'Sous-nature': pick(SOUS_NATURES, 'sous-natures'),
      'Type action': randomEnumValue(TYPE_ACTION, LBL_TYPE_ACTION),
      'Juridiction': juridiction.libelle,
      'Ville': juridiction.ville,
      'Montant en jeu': String(randomInt(1, 500) * 1_000_000),
      'Devise': 'XAF',
      'Statut': maybe(randomEnumValue(STATUT_DOSSIER, LBL_STATUT_DOSSIER)) ?? '',
      'Agent référent': fullName(agent),
      'Avocat mandaté': avocat ? fullName(avocat) : '',
      'Date ouverture': randomDateFR(-180, -1),
      'Prochaine échéance': randomDateFR(1, 90),
      'Progression %': String(randomInt(0, 100)),
      'Risque': maybe(randomEnumValue(RISQUE, LBL_RISQUE)) ?? '',
      'Résumé des faits': '',
      'Observations': '',
    });
  }
  return rows;
}
