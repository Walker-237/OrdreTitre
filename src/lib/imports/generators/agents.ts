import type { BootstrapData } from '../../../data/source';
import { maybe, pick, randomDateFR, randomInt } from './core';

const NOMS = ['NGONO', 'MEFIRE', 'TCHOKOTE', 'ABENG', 'BILOA', 'ONANA'];
const PRENOMS = ['Alice', 'Hervé', 'Carine', 'Mireille', 'Jules', 'Émilienne'];
const POSTES = ['Juriste senior', 'Juriste contentieux', 'Juriste junior', "Chargé d'affaires"];
const DIRECTIONS = ['DAJ', 'DRI', 'DSI', 'GFC', 'DRB', 'AUTRE'];

/** Aucune référence croisée pour cette entité — juste des données bien formées. */
export function generateAgentRows(_data: BootstrapData, count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const nom = pick(NOMS, 'noms');
    const prenom = pick(PRENOMS, 'prénoms');
    rows.push({
      'Matricule': maybe(`AFB-${randomInt(1000, 1999)}`) ?? '',
      'Nom': nom,
      'Prénom': prenom,
      'Poste': pick(POSTES, 'postes'),
      'Fonction': pick(POSTES, 'postes'),
      'Direction': pick(DIRECTIONS, 'directions'),
      'Téléphone': `+237 6${randomInt(70, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
      'Email': `${prenom.toLowerCase()}.${nom.toLowerCase()}.${i}@afrilandfirstbank.test`,
      'Taux': maybe(String(randomInt(1, 5) * 10_000)) ?? '0',
      'Actif': pick(['Oui', 'Non'], 'actif'),
      'Date prise de fonction': randomDateFR(-2000, -30),
      'Notes': '',
    });
  }
  return rows;
}
