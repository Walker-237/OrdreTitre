import { STATUT_PAIEMENT, TYPE_FRAIS } from '../../../models';
import { LBL_STATUT_PAIEMENT, LBL_TYPE_FRAIS } from '../../../labels';
import type { BootstrapData } from '../../../data/source';
import {
  fullName, maybe, pick, randomDateFR, randomEnumValue, randomInt,
} from './core';

export function generateHonoraireRows(data: BootstrapData, count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const dossier = pick(data.dossiers, 'dossiers');
    const avocat = pick(data.avocats, 'avocats');
    const montantFacture = randomInt(1, 50) * 100_000;
    rows.push({
      'Référence dossier': dossier.reference,
      'Avocat': fullName(avocat),
      'Référence facture': maybe(`FAC-${new Date().getFullYear()}-${randomInt(100, 999)}`) ?? '',
      'Type de frais': randomEnumValue(TYPE_FRAIS, LBL_TYPE_FRAIS),
      'Montant facturé': String(montantFacture),
      'Montant validé': maybe(String(montantFacture)) ?? '',
      'Montant payé': maybe(String(Math.round(montantFacture * randomInt(0, 100) / 100))) ?? '0',
      'Statut paiement': maybe(randomEnumValue(STATUT_PAIEMENT, LBL_STATUT_PAIEMENT)) ?? '',
      'Date facture': randomDateFR(-90, -1),
      'Date validation': maybe(randomDateFR(-60, -1)) ?? '',
      'Date paiement': maybe(randomDateFR(-30, -1)) ?? '',
      'Observations': '',
    });
  }
  return rows;
}
