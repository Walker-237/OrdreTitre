import { RESULTAT_DELIBERE, STATUT_DELIBERE, VOIE_RECOURS } from '../../../models';
import { LBL_RESULTAT_DELIBERE, LBL_STATUT_DELIBERE } from '../../../labels';
import type { BootstrapData } from '../../../data/source';
import {
  maybe, pick, randomDateFR, randomEnumValue, randomInt,
} from './core';

export function generateDelibereRows(data: BootstrapData, count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const dossier = pick(data.dossiers, 'dossiers');
    const nbVoies = randomInt(0, 2);
    const voies: string[] = [];
    for (let v = 0; v < nbVoies; v++) {
      const code = pick(VOIE_RECOURS, 'voies de recours');
      if (!voies.includes(code)) voies.push(code);
    }
    rows.push({
      'Référence dossier': dossier.reference,
      'Date prévue': randomDateFR(1, 60),
      'Date effective': maybe(randomDateFR(1, 60)) ?? '',
      'Statut': maybe(randomEnumValue(STATUT_DELIBERE, LBL_STATUT_DELIBERE)) ?? '',
      'Résultat': maybe(randomEnumValue(RESULTAT_DELIBERE, LBL_RESULTAT_DELIBERE)) ?? '',
      'Montant accordé': maybe(String(randomInt(1, 200) * 1_000_000)) ?? '',
      'Montant condamné': maybe(String(randomInt(1, 200) * 1_000_000)) ?? '',
      'Voies de recours': voies.join(', '),
      'Recours exercé': pick(['Oui', 'Non'], 'recours exercé'),
      'Grosse levée': pick(['Oui', 'Non'], 'grosse levée'),
      'Dispositif': '',
      'Observations': '',
    });
  }
  return rows;
}
