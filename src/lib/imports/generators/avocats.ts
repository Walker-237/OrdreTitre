import type { BootstrapData } from '../../../data/source';
import { maybe, pick, randomDateFR, randomInt } from './core';

const NOMS = ['KAMDEM', 'NDOUMOU', 'MBALLA', 'ETOUNDI', 'FOTSO', 'BIYICK', 'TCHOUAKE'];
const PRENOMS = ['Eric', 'Sylvie', 'Joseph', 'Béatrice', 'Paul', 'Clarisse', 'Hervé'];
const VILLES = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Bertoua'];
const SPECIALITES = ['Bancaire', 'Commercial', 'Social', 'Recouvrement', 'Immobilier'];

/** Aucune référence croisée pour cette entité — juste des données bien formées. */
export function generateAvocatRows(_data: BootstrapData, count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const nom = pick(NOMS, 'noms');
    const prenom = pick(PRENOMS, 'prénoms');
    rows.push({
      'Nom': nom,
      'Prénom': prenom,
      'Cabinet': `Cabinet ${nom} & Associés`,
      'N° barreau': `CM-${randomInt(2005, 2024)}-${String(randomInt(1, 999)).padStart(4, '0')}`,
      'Barreau': 'Cameroun',
      'Spécialités': `${pick(SPECIALITES, 'spécialités')}, ${pick(SPECIALITES, 'spécialités')}`,
      'Téléphone': `+237 6${randomInt(70, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
      'Téléphone secondaire': maybe(`+237 233 ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`) ?? '',
      'Email': `${prenom.toLowerCase()}.${nom.toLowerCase()}.${i}@cabinet-test.cm`,
      'Adresse': maybe('Bonanjo') ?? '',
      'Ville': pick(VILLES, 'villes'),
      'Seuil dossiers max': String(randomInt(10, 30)),
      'Taux': String(randomInt(1, 5) * 100_000),
      'Honoraires': '0',
      'Actif': pick(['Oui', 'Non'], 'actif'),
      'Date début collaboration': randomDateFR(-1800, -30),
      'Notes': '',
    });
  }
  return rows;
}
