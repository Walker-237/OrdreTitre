/**
 * Génère un fichier CSV par entité à partir du seed (mêmes données que
 * src/data/seed.ts). Sortie dans ./csv/ — directement importable dans Excel,
 * SharePoint Lists, ou Dataverse via la fonctionnalité d'import CSV.
 *
 * Usage :
 *   node scripts/export-csv.mjs
 *
 * Conventions :
 *   - Séparateur : virgule
 *   - Champs avec virgule / guillemet / saut de ligne : entourés de "…" et
 *     guillemets internes doublés ""
 *   - Booléens : TRUE / FALSE
 *   - Tableaux d'enums (specialites, voiesRecours, canaux, motsCles) :
 *     valeurs séparées par point-virgule
 *   - Tableaux d'objets (parties, pieces) : extraits dans des CSV dédiés
 *     liés par `dossierId`
 *   - Encodage : UTF-8 avec BOM (pour qu'Excel ouvre directement en français)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'csv');
mkdirSync(OUT_DIR, { recursive: true });

// ──────────────────────────── Helpers CSV ────────────────────────────────────
const BOM = '﻿';

function escape(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (Array.isArray(v)) v = v.join(';');
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(columns, rows) {
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(',')).join('\n');
  return BOM + header + '\n' + body + '\n';
}

function writeCsv(name, columns, rows) {
  const path = resolve(OUT_DIR, name);
  writeFileSync(path, toCsv(columns, rows), 'utf8');
  console.log(`  ✓ ${name}  (${rows.length} ligne${rows.length > 1 ? 's' : ''})`);
}

// ──────────────────────────── Données seed ──────────────────────────────────
const UTILISATEURS = [
  { id: 'u-admin', login: 'admin', nomAffichage: 'Fidèle BELLO', email: 'fidele_bello@afrilandfirstbank.com', role: 'ADMIN', isActive: true, sourceAuth: 'LOCAL', derniereConnexion: '2026-05-21T08:12:00Z' },
  { id: 'u-sup', login: 'mtopa', nomAffichage: 'Marie TOPA', email: 'm.topa@afrilandfirstbank.com', role: 'SUPERVISEUR', isActive: true, sourceAuth: 'AD' },
  { id: 'u-jur', login: 'pndjock', nomAffichage: 'Paul NDJOCK', email: 'p.ndjock@afrilandfirstbank.com', role: 'JURISTE', isActive: true, sourceAuth: 'AD' },
  { id: 'u-lect', login: 'sotomo', nomAffichage: 'Stéphanie OTOMO', email: 's.otomo@afrilandfirstbank.com', role: 'LECTEUR', isActive: true, sourceAuth: 'AD' },
];

const JURIDICTIONS = [
  { id: 'jur-tpi-yde', libelle: 'TPI de Yaoundé Centre Administratif', typeJuridiction: 'TRIBUNAL_PREMIERE_INSTANCE', niveau: 'PREMIER_DEGRE', ville: 'Yaoundé', pays: 'CM', isActive: true },
  { id: 'jur-tc-dla', libelle: 'Tribunal de Commerce de Douala', typeJuridiction: 'TRIBUNAL_COMMERCE', niveau: 'PREMIER_DEGRE', ville: 'Douala', pays: 'CM', isActive: true },
  { id: 'jur-ca-yde', libelle: "Cour d'Appel de Yaoundé", typeJuridiction: 'COUR_APPEL', niveau: 'APPEL', ville: 'Yaoundé', pays: 'CM', isActive: true },
  { id: 'jur-cs-yde', libelle: 'Cour Suprême du Cameroun', typeJuridiction: 'COUR_SUPREME', niveau: 'CASSATION', ville: 'Yaoundé', pays: 'CM', isActive: true },
];

const AVOCATS = [
  {
    id: 'av-001', nom: 'KAMDEM', prenom: 'Eric', cabinet: 'Cabinet KAMDEM & Associés',
    numeroBarreau: 'CM-2014-0218', barreau: 'Cameroun',
    specialites: ['DROIT_BANCAIRE', 'COMMERCIAL'], telephone: '+237 699 12 34 56',
    email: 'e.kamdem@kamdem-avocats.cm', ville: 'Douala',
    seuilDossiersMax: 25, dossiersActifs: 8, taux: 78, honoraires: 42000000,
    isActive: true, dateDebutCollaboration: '2021-03-01',
  },
  {
    id: 'av-002', nom: 'NDOUMOU', prenom: 'Sylvie', cabinet: 'SCP NDOUMOU',
    numeroBarreau: 'CM-2009-0114', barreau: 'Cameroun',
    specialites: ['SOCIAL', 'PRUD_HOMMES'], telephone: '+237 677 88 11 22',
    email: 's.ndoumou@scp-ndoumou.cm', ville: 'Yaoundé',
    seuilDossiersMax: 20, dossiersActifs: 6, taux: 71, honoraires: 19500000,
    isActive: true, dateDebutCollaboration: '2019-07-15',
  },
];

const AGENTS = [
  {
    id: 'ag-001', matricule: 'AFB-1024', nom: 'NGONO', prenom: 'Alice',
    poste: 'Juriste senior', fonction: 'Juriste senior', direction: 'DAJ',
    telephone: '+237 670 11 22 33', email: 'a.ngono@afrilandfirstbank.com',
    dossiers: 12, audiences: 18, taux: 82, isActive: true,
    datePriseFonction: '2019-02-01',
  },
  {
    id: 'ag-002', matricule: 'AFB-1102', nom: 'MEFIRE', prenom: 'Hervé',
    poste: 'Juriste contentieux', fonction: 'Juriste contentieux', direction: 'DAJ',
    telephone: '+237 670 44 55 66', email: 'h.mefire@afrilandfirstbank.com',
    dossiers: 9, audiences: 14, taux: 75, isActive: true,
  },
];

const DOSSIERS = [
  {
    id: 'd-001', reference: 'AFB-2025-00231',
    intitule: 'AFB c/ Sté COCOA TRADERS — Recouvrement crédit garanti',
    nature: 'COMMERCIALE', sousNature: "Inexécution d'obligations contractuelles",
    typeAction: 'DEMANDEUR', juridictionId: 'jur-tc-dla',
    juridiction: 'Tribunal de Commerce de Douala', ville: 'Douala',
    montantEnJeu: 425000000, devise: 'XAF', statut: 'EN_COURS',
    agentId: 'ag-001', agent: 'Alice NGONO',
    avocatId: 'av-001', avocat: 'Eric KAMDEM',
    dateOuverture: '2025-09-12', prochaineEcheance: '2026-06-04',
    progress: 55, risque: 'ELEVE',
    resumeFaits: 'Défaut de remboursement sur ouverture de crédit revolving de 500 MFCFA. Garantie hypothécaire sur entrepôts portuaires.',
    createdAt: '2025-09-12T09:30:00Z',
  },
  {
    id: 'd-002', reference: 'AFB-2025-00198',
    intitule: 'AFB c/ ABENG Mireille — Saisie immobilière',
    nature: 'CIVILE', sousNature: 'Exécution forcée',
    typeAction: 'DEMANDEUR', juridictionId: 'jur-tpi-yde',
    juridiction: 'TPI de Yaoundé Centre Administratif', ville: 'Yaoundé',
    montantEnJeu: 78500000, devise: 'XAF', statut: 'DELIBERE',
    agentId: 'ag-002', agent: 'Hervé MEFIRE',
    avocatId: 'av-002', avocat: 'Sylvie NDOUMOU',
    dateOuverture: '2025-04-08', prochaineEcheance: '2026-05-30',
    progress: 80, risque: 'MOYEN',
  },
  {
    id: 'd-003', reference: 'AFB-2026-00012',
    intitule: 'TANKEU Roger c/ AFB — Contestation de prélèvement',
    nature: 'CIVILE', sousNature: 'Action en restitution',
    typeAction: 'DEFENSEUR', juridictionId: 'jur-tpi-yde',
    juridiction: 'TPI de Yaoundé Centre Administratif', ville: 'Yaoundé',
    montantEnJeu: 12400000, devise: 'XAF', statut: 'OUVERT',
    agentId: 'ag-001', agent: 'Alice NGONO',
    avocatId: 'av-001', avocat: 'Eric KAMDEM',
    dateOuverture: '2026-01-22', prochaineEcheance: '2026-05-28',
    progress: 15, risque: 'FAIBLE',
  },
  {
    id: 'd-004', reference: 'AFB-2024-00472',
    intitule: 'BIYECK Justine c/ AFB — Licenciement abusif',
    nature: 'SOCIALE', sousNature: 'Indemnités',
    typeAction: 'DEFENSEUR', juridiction: "Conseil de Prud'hommes de Yaoundé",
    ville: 'Yaoundé', montantEnJeu: 18750000, devise: 'XAF',
    statut: 'CLOTURE', agentId: 'ag-002', agent: 'Hervé MEFIRE',
    avocatId: 'av-002', avocat: 'Sylvie NDOUMOU',
    dateOuverture: '2024-11-04', dateCloture: '2026-02-10', prochaineEcheance: '2026-02-10',
    progress: 100, risque: 'MOYEN',
  },
  {
    id: 'd-005', reference: 'AFB-2026-00021',
    intitule: 'AFB c/ MABEKO Jean-Paul — Compte débiteur',
    nature: 'COMMERCIALE', sousNature: 'Recouvrement amiable échoué',
    typeAction: 'DEMANDEUR', juridictionId: 'jur-tc-dla',
    juridiction: 'Tribunal de Commerce de Douala', ville: 'Douala',
    montantEnJeu: 4580000, devise: 'XAF', statut: 'OUVERT',
    agentId: 'ag-001', agent: 'Alice NGONO',
    avocatId: 'av-001', avocat: 'Eric KAMDEM',
    dateOuverture: '2026-03-02', prochaineEcheance: '2026-06-20',
    progress: 25, risque: 'FAIBLE',
  },
];

// Parties extraites des dossiers (relation 1-N via dossierId)
const PARTIES = [
  {
    dossierId: 'd-001', typePartie: 'PERSONNE_MORALE',
    nomRaisonSociale: 'COCOA TRADERS SARL',
    qualiteDansDossier: 'PARTIE_ADVERSE',
    adresse: 'Bonabéri, Douala', telephone: '+237 233 50 12 34',
  },
  {
    dossierId: 'd-002', typePartie: 'PERSONNE_PHYSIQUE',
    nomRaisonSociale: 'ABENG', prenom: 'Mireille',
    qualiteDansDossier: 'PARTIE_ADVERSE',
  },
  {
    dossierId: 'd-003', typePartie: 'PERSONNE_PHYSIQUE',
    nomRaisonSociale: 'TANKEU', prenom: 'Roger',
    qualiteDansDossier: 'DEMANDEUR',
  },
];

// Pièces extraites des dossiers
const PIECES = [
  {
    dossierId: 'd-001', libelle: 'Mise en demeure du 15/06/2025',
    typeDocument: 'CORRESPONDANCE', fichierNom: 'MED-COCOA-150625.pdf',
    tailleOctets: 312500, estConfidentiel: false,
  },
  {
    dossierId: 'd-001', libelle: 'Assignation',
    typeDocument: 'ASSIGNATION', fichierNom: 'ASSIG-2025-00231.pdf',
    tailleOctets: 1204800, estConfidentiel: false,
  },
];

const AUDIENCES = [
  {
    id: 'a-001', dossierId: 'd-001', date: '2026-06-04', heure: '09:00',
    statut: 'PLANIFIEE', typeAudience: 'PLAIDOIRIE',
    juridiction: 'Tribunal de Commerce de Douala', numeroRole: 'R-2026-1187',
    salleAudience: 'Salle B12', agent: 'Alice NGONO', objet: 'Plaidoiries au fond',
    rappelEnvoye: false,
  },
  {
    id: 'a-002', dossierId: 'd-002', date: '2026-05-12', heure: '10:30',
    dateTenueEffective: '2026-05-12T10:35:00Z',
    statut: 'EN_ATTENTE_DELIBERE', typeAudience: 'FOND',
    juridiction: 'TPI de Yaoundé Centre Administratif', numeroRole: 'R-2026-0492',
    agent: 'Hervé MEFIRE', objet: 'Saisie immobilière — clôture des débats',
    issueAudience: 'MIS_EN_DELIBERE', rappelEnvoye: true,
  },
  {
    id: 'a-003', dossierId: 'd-003', date: '2026-05-28', heure: '14:00',
    statut: 'PLANIFIEE', typeAudience: 'MISE_EN_ETAT',
    juridiction: 'TPI de Yaoundé Centre Administratif', numeroRole: 'R-2026-1031',
    agent: 'Alice NGONO', objet: 'Mise en état — communication des pièces',
    rappelEnvoye: false,
  },
  {
    id: 'a-004', dossierId: 'd-005', date: '2026-06-20', heure: '09:30',
    statut: 'PLANIFIEE', typeAudience: 'FOND',
    juridiction: 'Tribunal de Commerce de Douala',
    agent: 'Alice NGONO', objet: 'Compte débiteur — première audience',
    rappelEnvoye: false,
  },
];

const DELIBERES = [
  {
    id: 'de-001', dossierId: 'd-002', audienceOrigineId: 'a-002',
    dateDelibere: '2026-05-30', statut: 'EN_ATTENTE',
    voiesRecours: ['APPEL', 'POURVOI_CASSATION'],
    recoursExerce: false, grosseLevee: false,
  },
  {
    id: 'de-002', dossierId: 'd-004', dateDelibere: '2026-02-10',
    dateDelibereEffectif: '2026-02-10', statut: 'RENDU', resultat: 'FAVORABLE',
    dispositif: 'Demande rejetée. Bank confirmée dans ses droits.',
    decision: 'Demande rejetée. Bank confirmée dans ses droits.',
    voiesRecours: ['APPEL'], dateLimiteRecours: '2026-03-12',
    recoursExerce: false, grosseLevee: true, dateLeveeGrosse: '2026-02-25',
  },
];

const HONORAIRES = [
  {
    id: 'h-001', dossierId: 'd-001', avocatId: 'av-001',
    referenceFacture: 'KAMDEM-2026-018', typeFrais: 'HONORAIRES',
    montantFacture: 4500000, montantPaye: 2500000,
    statutPaiement: 'PARTIEL', dateFacture: '2026-04-12',
  },
  {
    id: 'h-002', dossierId: 'd-002', avocatId: 'av-002',
    referenceFacture: 'NDOUMOU-2026-007', typeFrais: 'HONORAIRES',
    montantFacture: 2800000, montantPaye: 2800000,
    statutPaiement: 'PAYE', dateFacture: '2026-03-18',
    datePaiement: '2026-04-02',
  },
];

const JURISPRUDENCE = [
  {
    id: 'jp-001', reference: 'CS-CM-2024-117', date: '2024-11-22',
    juridiction: 'Cour Suprême du Cameroun', matiere: 'COMMERCIALE',
    titre: "Inopposabilité d'une cession de créance non notifiée",
    resume: 'La Cour suprême confirme que la cession de créance non notifiée au débiteur cédé est inopposable à celui-ci.',
    motsCles: ['cession', 'créance', 'notification'], isPubliable: true,
  },
];

const ALERTES = [
  {
    id: 1, typeAlerte: 'RAPPEL_AUDIENCE', severity: 'high',
    title: 'Audience demain : AFB c/ COCOA TRADERS',
    dossier: 'AFB-2025-00231', dossierId: 'd-001', audienceId: 'a-001',
    message: 'Plaidoiries au fond — 9h00 — Salle B12, TC Douala',
    desc: 'Plaidoiries au fond — 9h00 — Salle B12, TC Douala',
    due: '2026-06-04', canaux: ['EMAIL', 'NOTIFICATION_PUSH'],
    statut: 'EN_ATTENTE', nbTentatives: 0,
  },
  {
    id: 2, typeAlerte: 'DELIBERE_ATTENDU', severity: 'high',
    title: 'Délibéré attendu — AFB-2025-00198',
    dossier: 'AFB-2025-00198', dossierId: 'd-002', delibereId: 'de-001',
    message: 'Délibéré prévu le 30/05/2026 — Saisie immobilière',
    desc: 'Délibéré prévu le 30/05/2026 — Saisie immobilière',
    due: '2026-05-30', canaux: ['EMAIL'],
    statut: 'EN_ATTENTE', nbTentatives: 0,
  },
  {
    id: 3, typeAlerte: 'FRAIS_A_PAYER', severity: 'medium',
    title: 'Solde honoraires — Cabinet KAMDEM',
    dossier: 'AFB-2025-00231', dossierId: 'd-001',
    message: '2 000 000 XAF restants à régler (facture KAMDEM-2026-018)',
    desc: '2 000 000 XAF restants à régler (facture KAMDEM-2026-018)',
    due: '2026-05-30', canaux: ['EMAIL'],
    statut: 'EN_ATTENTE', nbTentatives: 0,
  },
];

const AUDIT = [
  {
    id: 1, utilisateurId: 'u-admin', utilisateurLogin: 'admin',
    action: 'LOGIN', entiteCible: 'SESSION', idEntiteCible: 'sess-001',
    timestamp: '2026-05-21T08:12:14Z', ipAdresse: '10.0.12.44',
  },
  {
    id: 2, utilisateurId: 'u-jur', utilisateurLogin: 'pndjock',
    action: 'CREATE', entiteCible: 'DOSSIER_JUDICIAIRE', idEntiteCible: 'd-005',
    timestamp: '2026-03-02T09:48:00Z', ipAdresse: '10.0.12.81',
  },
];

// ──────────────────────────── Génération ────────────────────────────────────
console.log('Export CSV → ./csv/');

writeCsv('utilisateurs.csv',
  ['id', 'login', 'nomAffichage', 'email', 'role', 'isActive', 'sourceAuth', 'derniereConnexion', 'createdAt'],
  UTILISATEURS);

writeCsv('juridictions.csv',
  ['id', 'libelle', 'typeJuridiction', 'niveau', 'ville', 'pays', 'adresse', 'telephone', 'emailGreffe', 'isActive', 'notes'],
  JURIDICTIONS);

writeCsv('avocats.csv',
  ['id', 'utilisateurId', 'nom', 'prenom', 'cabinet', 'numeroBarreau', 'barreau', 'specialites', 'telephone', 'telephoneSecondaire', 'email', 'adresse', 'ville', 'seuilDossiersMax', 'dossiersActifs', 'taux', 'honoraires', 'isActive', 'dateDebutCollaboration', 'notes', 'createdAt', 'updatedAt'],
  AVOCATS);

writeCsv('agents.csv',
  ['id', 'utilisateurId', 'matricule', 'nom', 'prenom', 'poste', 'fonction', 'direction', 'telephone', 'email', 'dossiers', 'audiences', 'taux', 'isActive', 'datePriseFonction', 'notes', 'createdAt'],
  AGENTS);

writeCsv('dossiers.csv',
  ['id', 'reference', 'intitule', 'nature', 'sousNature', 'typeAction', 'juridictionId', 'juridiction', 'ville', 'montantEnJeu', 'devise', 'statut', 'agentId', 'agent', 'avocatId', 'avocat', 'dateOuverture', 'dateCloture', 'dateArchivage', 'prochaineEcheance', 'progress', 'risque', 'resumeFaits', 'observations', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'isDeleted'],
  DOSSIERS);

writeCsv('parties.csv',
  ['dossierId', 'id', 'typePartie', 'nomRaisonSociale', 'prenom', 'numeroCniRccm', 'nationalite', 'adresse', 'telephone', 'email', 'qualiteDansDossier', 'observations', 'createdAt'],
  PARTIES);

writeCsv('pieces.csv',
  ['dossierId', 'id', 'libelle', 'typeDocument', 'dateDocument', 'fichierNom', 'fichierUrl', 'mimeType', 'tailleOctets', 'estConfidentiel', 'uploadedBy', 'audienceId', 'delibereId', 'createdAt'],
  PIECES);

writeCsv('audiences.csv',
  ['id', 'dossierId', 'date', 'heure', 'dateTenueEffective', 'statut', 'typeAudience', 'juridictionId', 'juridiction', 'numeroRole', 'salleAudience', 'agentId', 'agent', 'avocatId', 'objet', 'compteRendu', 'issueAudience', 'dateRenvoi', 'piecesDeposees', 'rappelEnvoye', 'createdBy', 'createdAt', 'updatedAt'],
  AUDIENCES);

writeCsv('deliberes.csv',
  ['id', 'dossierId', 'audienceOrigineId', 'dateDelibere', 'dateDelibereEffectif', 'statut', 'resultat', 'dispositif', 'decision', 'montantAccorde', 'montantCondamne', 'voiesRecours', 'dateLimiteRecours', 'recoursExerce', 'typeRecoursExerce', 'dateExerciceRecours', 'grosseLevee', 'dateLeveeGrosse', 'agentSuiviId', 'observations', 'createdBy', 'createdAt', 'updatedAt'],
  DELIBERES);

writeCsv('honoraires.csv',
  ['id', 'dossierId', 'avocatId', 'referenceFacture', 'typeFrais', 'montantFacture', 'montantValide', 'montantPaye', 'statutPaiement', 'dateFacture', 'dateValidation', 'datePaiement', 'validateurId', 'pieceJointeUrl', 'observations', 'createdAt'],
  HONORAIRES);

writeCsv('jurisprudence.csv',
  ['id', 'delibereId', 'dossierId', 'juridictionId', 'reference', 'date', 'juridiction', 'matiere', 'titre', 'resume', 'dispositif', 'motsCles', 'annotations', 'fichierUrl', 'isPubliable', 'createdBy', 'createdAt'],
  JURISPRUDENCE);

writeCsv('alertes.csv',
  ['id', 'typeAlerte', 'severity', 'title', 'dossier', 'dossierId', 'audienceId', 'delibereId', 'destinataireId', 'message', 'desc', 'due', 'canaux', 'statut', 'dateEnvoiEffectif', 'dateLecture', 'nbTentatives', 'createdAt'],
  ALERTES);

writeCsv('audit.csv',
  ['id', 'utilisateurId', 'utilisateurLogin', 'action', 'entiteCible', 'idEntiteCible', 'valeurAvant', 'valeurApres', 'ipAdresse', 'userAgent', 'timestamp'],
  AUDIT);

console.log(`\nDone — ${OUT_DIR}`);
