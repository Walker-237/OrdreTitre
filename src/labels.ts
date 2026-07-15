/**
 * Libellés FR — porté depuis Audience/src/app/labels.ts.
 * Stockage en MAJUSCULES, affichage en français.
 */
import type {
  NatureProcedure, StatutDossier, TypeAction, RisqueLevel,
  TypeJuridiction, NiveauJuridiction, TypePartie, QualitePartie,
  StatutAudience, TypeAudience, IssueAudience,
  StatutDelibere, ResultatDelibere, VoieRecours,
  Role, SourceAuth, Direction,
  TypeFrais, StatutPaiement, TypeDocument,
  TypeAlerte, CanalAlerte, StatutAlerte, AuditAction,
} from './models';

export const LBL_NATURE: Record<NatureProcedure, string> = {
  PENALE: 'Pénale', SOCIALE: 'Sociale', CIVILE: 'Civile',
  COMMERCIALE: 'Commerciale', ARBITRALE: 'Arbitrale', AUTRE: 'Autre',
};

export const LBL_TYPE_ACTION: Record<TypeAction, string> = {
  DEFENSEUR: 'Défendeur', DEMANDEUR: 'Demandeur',
};

export const LBL_STATUT_DOSSIER: Record<StatutDossier, string> = {
  OUVERT: 'Ouvert', EN_COURS: 'En cours', DELIBERE: 'Délibéré',
  CLOTURE: 'Clôturé', ARCHIVE: 'Archivé',
};

export const LBL_RISQUE: Record<RisqueLevel, string> = {
  FAIBLE: 'Faible', MOYEN: 'Moyen', ELEVE: 'Élevé',
};

export const LBL_TYPE_JURIDICTION: Record<TypeJuridiction, string> = {
  TRIBUNAL_PREMIERE_INSTANCE: 'Tribunal de Première Instance',
  COUR_APPEL: "Cour d'Appel", COUR_SUPREME: 'Cour Suprême',
  TRIBUNAL_COMMERCE: 'Tribunal de Commerce',
  CONSEIL_PRUD_HOMMES: "Conseil de Prud'hommes",
  TRIBUNAL_ARBITRAL: 'Tribunal Arbitral', AUTRE: 'Autre',
};

export const LBL_NIVEAU_JURIDICTION: Record<NiveauJuridiction, string> = {
  PREMIER_DEGRE: 'Premier degré', APPEL: 'Appel',
  CASSATION: 'Cassation', INTERNATIONAL: 'International',
};

export const LBL_TYPE_PARTIE: Record<TypePartie, string> = {
  PERSONNE_PHYSIQUE: 'Personne physique', PERSONNE_MORALE: 'Personne morale',
};

export const LBL_QUALITE_PARTIE: Record<QualitePartie, string> = {
  PARTIE_ADVERSE: 'Partie adverse', GARANT: 'Garant', CODEBITOR: 'Codébiteur',
  TIERS: 'Tiers', DEMANDEUR: 'Demandeur', AUTRE: 'Autre',
};

export const LBL_STATUT_AUDIENCE: Record<StatutAudience, string> = {
  PLANIFIEE: 'Planifiée', TENUE: 'Tenue', REPORTEE: 'Reportée',
  ANNULEE: 'Annulée', EN_ATTENTE_DELIBERE: 'En attente délibéré',
};

export const LBL_TYPE_AUDIENCE: Record<TypeAudience, string> = {
  FOND: 'Audience au fond', REFERE: 'Référé', MISE_EN_ETAT: 'Mise en état',
  PLAIDOIRIE: 'Plaidoiries', CONCILIATION: 'Conciliation', AUTRE: 'Autre',
};

export const LBL_ISSUE_AUDIENCE: Record<IssueAudience, string> = {
  RENVOYE: 'Renvoyée', MIS_EN_DELIBERE: 'Mise en délibéré',
  CONCILIE: 'Conciliée', JUGE: 'Jugée', EN_ATTENTE: 'En attente', AUTRE: 'Autre',
};

export const LBL_STATUT_DELIBERE: Record<StatutDelibere, string> = {
  EN_ATTENTE: 'Attendu', RENDU: 'Rendu', REPORTE: 'Reporté', SANS_SUITE: 'Sans suite',
};

export const LBL_RESULTAT_DELIBERE: Record<ResultatDelibere, string> = {
  FAVORABLE: 'Favorable', DEFAVORABLE: 'Défavorable',
  MIXTE: 'Mixte', PARTIEL: 'Partiel',
};

export const LBL_VOIE_RECOURS: Record<VoieRecours, string> = {
  APPEL: 'Appel', POURVOI_CASSATION: 'Pourvoi en cassation',
  TIERCE_OPPOSITION: 'Tierce opposition', OPPOSITION: 'Opposition', AUCUNE: 'Aucune',
};

export const LBL_ROLE: Record<Role, string> = {
  ADMIN: 'Administrateur', SUPERVISEUR: 'Superviseur', JURISTE: 'Juriste',
  LECTEUR: 'Lecteur', AVOCAT_EXTERNE: 'Avocat externe',
};

export const LBL_SOURCE_AUTH: Record<SourceAuth, string> = {
  LDAP: 'LDAP', AD: 'Active Directory', LOCAL: 'Compte local',
};

export const LBL_DIRECTION: Record<Direction, string> = {
  DAJ: 'Direction des Affaires Juridiques',
  DRI: 'Direction des Risques',
  DSI: "Direction des Systèmes d'Information",
  GFC: 'Gestion Financière et Comptabilité',
  DRB: 'Direction du Réseau Bancaire',
  AUTRE: 'Autre direction',
};

export const LBL_TYPE_FRAIS: Record<TypeFrais, string> = {
  HONORAIRES: 'Honoraires', FRAIS_DE_CONSIGNATION: 'Frais de consignation',
  DROITS_ENREGISTREMENT: "Droits d'enregistrement",
  FRAIS_EXPERTISE: "Frais d'expertise", FRAIS_HUISSIER: "Frais d'huissier",
  AUTRE: 'Autre frais',
};

export const LBL_STATUT_PAIEMENT: Record<StatutPaiement, string> = {
  EN_ATTENTE: 'En attente', VALIDE: 'Validé', PAYE: 'Payé',
  REJETE: 'Rejeté', PARTIEL: 'Paiement partiel',
};

export const LBL_TYPE_DOCUMENT: Record<TypeDocument, string> = {
  ASSIGNATION: 'Assignation', CONCLUSIONS: 'Conclusions', JUGEMENT: 'Jugement',
  ORDONNANCE: 'Ordonnance', REQUETE: 'Requête', ACTE_HUISSIER: "Acte d'huissier",
  CORRESPONDANCE: 'Correspondance', AUTRE: 'Autre document',
};

export const LBL_TYPE_ALERTE: Record<TypeAlerte, string> = {
  RAPPEL_AUDIENCE: "Rappel d'audience", DELAI_RECOURS: 'Délai de recours',
  DOSSIER_INCOMPLET: 'Dossier incomplet', FRAIS_A_PAYER: 'Frais à payer',
  DELIBERE_ATTENDU: 'Délibéré attendu', CHARGE_AVOCAT: 'Charge avocat',
  INACTIVITE_DOSSIER: 'Inactivité dossier', AUTRE: 'Autre alerte',
};

export const LBL_CANAL_ALERTE: Record<CanalAlerte, string> = {
  EMAIL: 'Email', NOTIFICATION_PUSH: 'Push', TEAMS: 'Teams', SMS: 'SMS',
};

export const LBL_STATUT_ALERTE: Record<StatutAlerte, string> = {
  EN_ATTENTE: 'En attente', ENVOYEE: 'Envoyée', LUE: 'Lue',
  IGNOREE: 'Ignorée', ERREUR: "Erreur d'envoi",
};

export const LBL_AUDIT_ACTION: Record<AuditAction, string> = {
  CREATE: 'Création', READ: 'Consultation', UPDATE: 'Modification',
  DELETE: 'Suppression', LOGIN: 'Connexion', LOGOUT: 'Déconnexion',
  EXPORT: 'Export', PRINT: 'Impression',
};

/** Niveau de criticité par défaut associé à un type d'alerte (§ 4.5). */
export function severityForAlerte(type: TypeAlerte): 'high' | 'medium' | 'low' {
  switch (type) {
    case 'RAPPEL_AUDIENCE':
    case 'DELIBERE_ATTENDU':
    case 'DELAI_RECOURS':
      return 'high';
    case 'DOSSIER_INCOMPLET':
    case 'FRAIS_A_PAYER':
      return 'medium';
    default:
      return 'low';
  }
}

/** Conversion bytes → libellé humain. */
export function tailleHumaine(octets: number | undefined | null): string {
  if (typeof octets !== 'number' || octets < 0) return '—';
  if (octets < 1024) return octets + ' o';
  if (octets < 1024 * 1024) return (octets / 1024).toFixed(0) + ' Ko';
  if (octets < 1024 * 1024 * 1024) return (octets / 1024 / 1024).toFixed(1) + ' Mo';
  return (octets / 1024 / 1024 / 1024).toFixed(2) + ' Go';
}

/** Format compact d'un montant FCFA : « 15M XAF », « 1,2Md XAF ». */
export function formatMontantCourt(n: number | null | undefined, devise = 'XAF'): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const abrege = (x: number) =>
    (Math.round(x * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  let valeur: string;
  if (abs >= 1_000_000_000) valeur = abrege(n / 1_000_000_000) + 'Md';
  else if (abs >= 1_000_000) valeur = abrege(n / 1_000_000) + 'M';
  else valeur = n.toLocaleString('fr-FR');
  return valeur + ' ' + devise;
}

/** Format d'une date ISO en JJ/MM/AAAA. */
export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
