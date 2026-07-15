/**
 * Modèle de données — porté depuis Audience/src/app/models.ts (TS pur).
 * Aligné sur AFB_SP_PR01_PM03_AudiencesDeliberes_V1.0_2025, section 2.
 */

// ============================================================
// 1.  ÉNUMÉRATIONS
// ============================================================

export const NATURE_PROCEDURE = [
  'PENALE', 'SOCIALE', 'CIVILE', 'COMMERCIALE', 'ARBITRALE', 'AUTRE',
] as const;
export type NatureProcedure = (typeof NATURE_PROCEDURE)[number];

export const TYPE_ACTION = ['DEFENSEUR', 'DEMANDEUR'] as const;
export type TypeAction = (typeof TYPE_ACTION)[number];

export const STATUT_DOSSIER = [
  'OUVERT', 'EN_COURS', 'DELIBERE', 'CLOTURE', 'ARCHIVE',
] as const;
export type StatutDossier = (typeof STATUT_DOSSIER)[number];

export const RISQUE = ['FAIBLE', 'MOYEN', 'ELEVE'] as const;
export type RisqueLevel = (typeof RISQUE)[number];

export const TYPE_JURIDICTION = [
  'TRIBUNAL_PREMIERE_INSTANCE', 'COUR_APPEL', 'COUR_SUPREME',
  'TRIBUNAL_COMMERCE', 'CONSEIL_PRUD_HOMMES', 'TRIBUNAL_ARBITRAL', 'AUTRE',
] as const;
export type TypeJuridiction = (typeof TYPE_JURIDICTION)[number];

export const NIVEAU_JURIDICTION = [
  'PREMIER_DEGRE', 'APPEL', 'CASSATION', 'INTERNATIONAL',
] as const;
export type NiveauJuridiction = (typeof NIVEAU_JURIDICTION)[number];

export const TYPE_PARTIE = ['PERSONNE_PHYSIQUE', 'PERSONNE_MORALE'] as const;
export type TypePartie = (typeof TYPE_PARTIE)[number];

export const QUALITE_PARTIE = [
  'PARTIE_ADVERSE', 'GARANT', 'CODEBITOR', 'TIERS', 'DEMANDEUR', 'AUTRE',
] as const;
export type QualitePartie = (typeof QUALITE_PARTIE)[number];

export const STATUT_AUDIENCE = [
  'PLANIFIEE', 'TENUE', 'REPORTEE', 'ANNULEE', 'EN_ATTENTE_DELIBERE',
] as const;
export type StatutAudience = (typeof STATUT_AUDIENCE)[number];

export const TYPE_AUDIENCE = [
  'FOND', 'REFERE', 'MISE_EN_ETAT', 'PLAIDOIRIE', 'CONCILIATION', 'AUTRE',
] as const;
export type TypeAudience = (typeof TYPE_AUDIENCE)[number];

export const ISSUE_AUDIENCE = [
  'RENVOYE', 'MIS_EN_DELIBERE', 'CONCILIE', 'JUGE', 'EN_ATTENTE', 'AUTRE',
] as const;
export type IssueAudience = (typeof ISSUE_AUDIENCE)[number];

export const STATUT_DELIBERE = [
  'EN_ATTENTE', 'RENDU', 'REPORTE', 'SANS_SUITE',
] as const;
export type StatutDelibere = (typeof STATUT_DELIBERE)[number];

export const RESULTAT_DELIBERE = [
  'FAVORABLE', 'DEFAVORABLE', 'MIXTE', 'PARTIEL',
] as const;
export type ResultatDelibere = (typeof RESULTAT_DELIBERE)[number];

export const VOIE_RECOURS = [
  'APPEL', 'POURVOI_CASSATION', 'TIERCE_OPPOSITION', 'OPPOSITION', 'AUCUNE',
] as const;
export type VoieRecours = (typeof VOIE_RECOURS)[number];

export const ROLE = [
  'ADMIN', 'SUPERVISEUR', 'JURISTE', 'LECTEUR', 'AVOCAT_EXTERNE',
] as const;
export type Role = (typeof ROLE)[number];

export const SOURCE_AUTH = ['LDAP', 'AD', 'LOCAL'] as const;
export type SourceAuth = (typeof SOURCE_AUTH)[number];

export type Direction = string;

export interface Departement {
  code: string;
  libelle: string;
  ordre: number;
  actif: boolean;
  createdAt?: string;
}

export const TYPE_FRAIS = [
  'HONORAIRES', 'FRAIS_DE_CONSIGNATION', 'DROITS_ENREGISTREMENT',
  'FRAIS_EXPERTISE', 'FRAIS_HUISSIER', 'AUTRE',
] as const;
export type TypeFrais = (typeof TYPE_FRAIS)[number];

export const STATUT_PAIEMENT = [
  'EN_ATTENTE', 'VALIDE', 'PAYE', 'REJETE', 'PARTIEL',
] as const;
export type StatutPaiement = (typeof STATUT_PAIEMENT)[number];

export const TYPE_DOCUMENT = [
  'ASSIGNATION', 'CONCLUSIONS', 'JUGEMENT', 'ORDONNANCE', 'REQUETE',
  'ACTE_HUISSIER', 'CORRESPONDANCE', 'AUTRE',
] as const;
export type TypeDocument = (typeof TYPE_DOCUMENT)[number];

export const TYPE_ALERTE = [
  'RAPPEL_AUDIENCE', 'DELAI_RECOURS', 'DOSSIER_INCOMPLET', 'FRAIS_A_PAYER',
  'DELIBERE_ATTENDU', 'CHARGE_AVOCAT', 'INACTIVITE_DOSSIER', 'AUTRE',
] as const;
export type TypeAlerte = (typeof TYPE_ALERTE)[number];

export const CANAL_ALERTE = ['EMAIL', 'NOTIFICATION_PUSH', 'TEAMS', 'SMS'] as const;
export type CanalAlerte = (typeof CANAL_ALERTE)[number];

export const STATUT_ALERTE = ['EN_ATTENTE', 'ENVOYEE', 'LUE', 'IGNOREE', 'ERREUR'] as const;
export type StatutAlerte = (typeof STATUT_ALERTE)[number];

export const AUDIT_ACTION = [
  'CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT',
] as const;
export type AuditAction = (typeof AUDIT_ACTION)[number];

export type Severity = 'high' | 'medium' | 'low';

// ============================================================
// 2.  ENTITÉS PRINCIPALES
// ============================================================

export interface Partie {
  id?: string;
  typePartie: TypePartie;
  nomRaisonSociale: string;
  prenom?: string;
  numeroCniRccm?: string;
  nationalite?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  qualiteDansDossier: QualitePartie;
  observations?: string;
  createdAt?: string;
}

/**
 * Type d'entité parente d'une pièce jointe. Sert au dispatch des mutations
 * `addEntityPiece`/`removeEntityPiece` sur le `DataSource`.
 */
export const PIECE_PARENT_TYPE = [
  'DOSSIER', 'AUDIENCE', 'DELIBERE', 'HONORAIRE', 'JURISPRUDENCE', 'AVOCAT',
] as const;
export type PieceParentType = (typeof PIECE_PARENT_TYPE)[number];

export interface Piece {
  id?: string;
  /** Identifiant du parent (mutuellement exclusif avec les autres *Id ci-dessous). */
  dossierId?: string;
  audienceId?: string;
  delibereId?: string;
  honoraireId?: string;
  jurisprudenceId?: string;
  avocatId?: string;
  libelle: string;
  typeDocument: TypeDocument;
  dateDocument?: string;
  fichierNom: string;
  fichierUrl?: string;
  mimeType?: string;
  tailleOctets?: number;
  estConfidentiel: boolean;
  uploadedBy?: string;
  createdAt?: string;
}

export interface Dossier {
  id: string;
  reference: string;
  intitule: string;
  nature: NatureProcedure;
  sousNature: string;
  typeAction: TypeAction;
  juridictionId?: string;
  juridiction: string;
  ville: string;
  montantEnJeu: number;
  devise: string;
  statut: StatutDossier;
  agentId?: string;
  agent: string;
  avocatId?: string;
  avocat: string;
  dateOuverture: string;
  dateCloture?: string;
  dateArchivage?: string;
  prochaineEcheance: string;
  progress: number;
  risque: RisqueLevel;
  resumeFaits?: string;
  observations?: string;
  parties: Partie[];
  pieces: Piece[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface Audience {
  id: string;
  dossierId: string;
  date: string;
  heure: string;
  dateTenueEffective?: string;
  statut: StatutAudience;
  typeAudience: TypeAudience;
  juridictionId?: string;
  juridiction: string;
  numeroRole?: string;
  salleAudience?: string;
  agentId?: string;
  agent: string;
  avocatId?: string;
  objet: string;
  compteRendu?: string;
  issueAudience?: IssueAudience;
  dateRenvoi?: string;
  piecesDeposees?: string;
  rappelEnvoye: boolean;
  /** Pièces jointes attachées à l'audience (PV, compte rendu, notes…). */
  pieces?: Piece[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Delibere {
  id: string;
  dossierId: string;
  audienceOrigineId?: string;
  dateDelibere: string;
  dateDelibereEffectif?: string;
  statut: StatutDelibere;
  resultat?: ResultatDelibere;
  dispositif?: string;
  decision?: string;
  montantAccorde?: number;
  montantCondamne?: number;
  voiesRecours: VoieRecours[];
  dateLimiteRecours?: string;
  recoursExerce: boolean;
  typeRecoursExerce?: VoieRecours;
  dateExerciceRecours?: string;
  grosseLevee: boolean;
  dateLeveeGrosse?: string;
  agentSuiviId?: string;
  observations?: string;
  /** Pièces jointes attachées au délibéré (décision, grosse, notes d'appel…). */
  pieces?: Piece[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Avocat {
  id: string;
  utilisateurId?: string;
  nom: string;
  prenom?: string;
  cabinet: string;
  numeroBarreau?: string;
  barreau?: string;
  specialites: string[];
  telephone: string;
  telephoneSecondaire?: string;
  email: string;
  adresse?: string;
  ville: string;
  seuilDossiersMax: number;
  dossiersActifs: number;
  taux: number;
  honoraires: number;
  isActive: boolean;
  dateDebutCollaboration?: string;
  notes?: string;
  /** Pièces jointes attachées à l'avocat (convention, mandat, CV…). */
  pieces?: Piece[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Agent {
  id: string;
  utilisateurId?: string;
  matricule?: string;
  nom: string;
  prenom?: string;
  poste: string;
  fonction: string;
  direction: string;
  telephone: string;
  email: string;
  dossiers: number;
  audiences: number;
  taux: number;
  isActive: boolean;
  datePriseFonction?: string;
  notes?: string;
  createdAt?: string;
}

export interface Utilisateur {
  id: string;
  login: string;
  nomAffichage: string;
  email: string;
  role: Role;
  isActive: boolean;
  derniereConnexion?: string;
  sourceAuth: SourceAuth;
  createdAt?: string;
}

export interface Juridiction {
  id: string;
  libelle: string;
  typeJuridiction: TypeJuridiction;
  niveau: NiveauJuridiction;
  ville: string;
  pays: string;
  adresse?: string;
  telephone?: string;
  emailGreffe?: string;
  isActive: boolean;
  notes?: string;
}

export interface Honoraire {
  id: string;
  dossierId: string;
  avocatId: string;
  referenceFacture?: string;
  typeFrais: TypeFrais;
  montantFacture: number;
  montantValide?: number;
  montantPaye: number;
  statutPaiement: StatutPaiement;
  dateFacture: string;
  dateValidation?: string;
  datePaiement?: string;
  validateurId?: string;
  pieceJointeUrl?: string;
  observations?: string;
  /** Pièces jointes attachées à la facture (justificatif, bon, échange…). */
  pieces?: Piece[];
  createdAt?: string;
}

export interface Alerte {
  /** Identifiant numérique attribué à la volée par le moteur (stable par session
   *  pour un jeu de données donné — repose sur l'ordre déterministe du compute). */
  id: number;
  /** Clé canonique stable (read/dismissed sets). Émise par recomputeAlertes —
   *  source unique de vérité, à préférer à derivedKey() côté store. */
  key?: string;
  typeAlerte: TypeAlerte;
  severity: Severity;
  title: string;
  dossier: string;
  dossierId?: string;
  audienceId?: string;
  delibereId?: string;
  destinataireId?: string;
  message: string;
  desc: string;
  due: string;
  canaux: CanalAlerte[];
  statut: StatutAlerte;
  dateEnvoiEffectif?: string;
  dateLecture?: string;
  nbTentatives: number;
  createdAt?: string;
}

/**
 * Délais légaux de recours, en jours, par matière et par voie (§ 4.3 du cahier).
 * Clé : `${VoieRecours}_${NatureProcedure}` ; valeurs par défaut pour les voies
 * sans dépendance à la matière.
 */
export const DELAIS_RECOURS_JOURS: Record<string, number> = {
  APPEL_PENALE: 10,
  APPEL_CIVILE: 30,
  APPEL_COMMERCIALE: 30,
  APPEL_SOCIALE: 30,
  APPEL_ARBITRALE: 30,
  APPEL_AUTRE: 30,
  POURVOI_CASSATION_PENALE: 30,
  POURVOI_CASSATION_CIVILE: 30,
  POURVOI_CASSATION_COMMERCIALE: 30,
  POURVOI_CASSATION_SOCIALE: 30,
  POURVOI_CASSATION_ARBITRALE: 30,
  POURVOI_CASSATION_AUTRE: 30,
  TIERCE_OPPOSITION_DEFAULT: 30,
  OPPOSITION_DEFAULT: 15,
};

export interface JournalAuditEntry {
  id: number;
  utilisateurId: string;
  utilisateurLogin: string;
  action: AuditAction;
  entiteCible: string;
  idEntiteCible: string;
  valeurAvant?: string;
  valeurApres?: string;
  ipAdresse?: string;
  userAgent?: string;
  timestamp: string;
}

export interface JurisprudenceEntry {
  id: string;
  delibereId?: string;
  dossierId?: string;
  juridictionId?: string;
  reference: string;
  date: string;
  juridiction: string;
  matiere: NatureProcedure;
  titre?: string;
  resume: string;
  dispositif?: string;
  motsCles: string[];
  annotations?: string;
  fichierUrl?: string;
  /** Pièces jointes additionnelles (annotations PDF, doctrine liée…). */
  pieces?: Piece[];
  isPubliable: boolean;
  createdBy?: string;
  createdAt?: string;
}
