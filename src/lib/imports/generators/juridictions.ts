import { NIVEAU_JURIDICTION, TYPE_JURIDICTION } from '../../../models';
import { LBL_NIVEAU_JURIDICTION, LBL_TYPE_JURIDICTION } from '../../../labels';
import type { BootstrapData } from '../../../data/source';
import { maybe, pick, randomEnumValue, randomInt } from './core';

const VILLES = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Bertoua', 'Ngaoundéré'];

/** Aucune référence croisée pour cette entité — juste des données bien formées. */
export function generateJuridictionRows(_data: BootstrapData, count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const ville = pick(VILLES, 'villes');
    const type = randomEnumValue(TYPE_JURIDICTION, LBL_TYPE_JURIDICTION);
    rows.push({
      'Libellé': `Juridiction de test ${ville} #${randomInt(1, 999)}`,
      'Type': type,
      'Niveau': randomEnumValue(NIVEAU_JURIDICTION, LBL_NIVEAU_JURIDICTION),
      'Ville': ville,
      'Pays': 'Cameroun',
      'Adresse': maybe('BP 1234') ?? '',
      'Téléphone': maybe(`+237 233 ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`) ?? '',
      'Email greffe': maybe(`greffe.${ville.toLowerCase()}.${i}@trib-cmr.test`) ?? '',
      'Actif': pick(['Oui', 'Non'], 'actif'),
      'Notes': '',
    });
  }
  return rows;
}
