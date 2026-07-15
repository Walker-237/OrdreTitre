/**
 * Implémentation Dataverse de DataSource — appelle les services typés générés
 * par `pac code add-data-source` (cf. DATAVERSE.md à la racine).
 *
 * État actuel : SQUELETTE. Tant que les tables Dataverse et les services
 * générés ne sont pas en place, chaque opération rejette avec un message
 * explicite. La sélection se fait dans src/data/source.ts (`USE_DATAVERSE`).
 *
 * Marche à suivre après création des tables + add-data-source :
 *   1) Décommenter les imports `import ... from '../../Services/<TableService>'`.
 *   2) Remplir `bootstrap()` avec `await Promise.all([...].map((s) => s.getAll()))`.
 *   3) Mapper les enregistrements Dataverse vers les types `Dossier`, `Audience`,
 *      etc. (les noms de colonnes Dataverse sont préfixés par le publisher).
 *   4) Mettre `USE_DATAVERSE = true` dans `source.ts`.
 */
import type {
  Agent, Audience, Avocat, Delibere, Dossier, Honoraire,
  Juridiction, JournalAuditEntry, JurisprudenceEntry, Piece,
  PieceParentType, Utilisateur,
} from '../../models';
import type {
  AgentInput, AudienceInput, AvocatInput, BootstrapData, DataSource,
  DelibereInput, DossierInput, HonoraireInput, JuridictionInput,
  JurisprudenceInput, UtilisateurInput,
} from '../source';

// ─── À DÉCOMMENTER une fois `pac code add-data-source` exécuté ───────────────
// import { DossierService } from '../../Services/DossierService';
// import { AudienceService } from '../../Services/AudienceService';
// import { DelibereService } from '../../Services/DelibereService';
// import { AvocatService } from '../../Services/AvocatService';
// import { AgentService } from '../../Services/AgentService';
// import { JuridictionService } from '../../Services/JuridictionService';
// import { HonoraireService } from '../../Services/HonoraireService';
// import { JurisprudenceService } from '../../Services/JurisprudenceService';
// import { AlerteService } from '../../Services/AlerteService';
// import { UtilisateurService } from '../../Services/UtilisateurService';

function notImplemented(method: string): never {
  throw new Error(`DataverseDataSource.${method} non branché — voir DATAVERSE.md.`);
}

export class DataverseDataSource implements DataSource {
  async bootstrap(): Promise<BootstrapData> {
    notImplemented('bootstrap');
  }

  // ── Dossiers ───────────────────────────────────────────────────────────────
  async createDossier(_input: DossierInput): Promise<Dossier> { void _input; notImplemented('createDossier'); }
  async updateDossier(_id: string, _patch: Partial<Dossier>): Promise<Dossier> { void _id; void _patch; notImplemented('updateDossier'); }
  async deleteDossier(_id: string): Promise<void> { void _id; notImplemented('deleteDossier'); }
  async addPiece(_did: string, _p: Omit<Piece, 'id' | 'createdAt'>): Promise<Dossier> { void _did; void _p; notImplemented('addPiece'); }
  async removePiece(_did: string, _pid: string): Promise<Dossier> { void _did; void _pid; notImplemented('removePiece'); }
  async addEntityPiece(_t: PieceParentType, _id: string, _p: Omit<Piece, 'id' | 'createdAt'>): Promise<unknown> { void _t; void _id; void _p; notImplemented('addEntityPiece'); }
  async removeEntityPiece(_t: PieceParentType, _id: string, _pid: string): Promise<unknown> { void _t; void _id; void _pid; notImplemented('removeEntityPiece'); }

  // ── Audiences ──────────────────────────────────────────────────────────────
  async createAudience(_input: AudienceInput): Promise<Audience> { void _input; notImplemented('createAudience'); }
  async updateAudience(_id: string, _patch: Partial<Audience>): Promise<Audience> { void _id; void _patch; notImplemented('updateAudience'); }
  async deleteAudience(_id: string): Promise<void> { void _id; notImplemented('deleteAudience'); }

  // ── Délibérés ──────────────────────────────────────────────────────────────
  async createDelibere(_input: DelibereInput): Promise<Delibere> { void _input; notImplemented('createDelibere'); }
  async updateDelibere(_id: string, _patch: Partial<Delibere>): Promise<Delibere> { void _id; void _patch; notImplemented('updateDelibere'); }
  async deleteDelibere(_id: string): Promise<void> { void _id; notImplemented('deleteDelibere'); }

  // ── Avocats ────────────────────────────────────────────────────────────────
  async createAvocat(_input: AvocatInput): Promise<Avocat> { void _input; notImplemented('createAvocat'); }
  async updateAvocat(_id: string, _patch: Partial<Avocat>): Promise<Avocat> { void _id; void _patch; notImplemented('updateAvocat'); }
  async deleteAvocat(_id: string): Promise<void> { void _id; notImplemented('deleteAvocat'); }

  // ── Agents ─────────────────────────────────────────────────────────────────
  async createAgent(_input: AgentInput): Promise<Agent> { void _input; notImplemented('createAgent'); }
  async updateAgent(_id: string, _patch: Partial<Agent>): Promise<Agent> { void _id; void _patch; notImplemented('updateAgent'); }
  async deleteAgent(_id: string): Promise<void> { void _id; notImplemented('deleteAgent'); }

  // ── Juridictions ───────────────────────────────────────────────────────────
  async createJuridiction(_input: JuridictionInput): Promise<Juridiction> { void _input; notImplemented('createJuridiction'); }
  async updateJuridiction(_id: string, _patch: Partial<Juridiction>): Promise<Juridiction> { void _id; void _patch; notImplemented('updateJuridiction'); }
  async deleteJuridiction(_id: string): Promise<void> { void _id; notImplemented('deleteJuridiction'); }

  // ── Honoraires ─────────────────────────────────────────────────────────────
  async createHonoraire(_input: HonoraireInput): Promise<Honoraire> { void _input; notImplemented('createHonoraire'); }
  async updateHonoraire(_id: string, _patch: Partial<Honoraire>): Promise<Honoraire> { void _id; void _patch; notImplemented('updateHonoraire'); }
  async deleteHonoraire(_id: string): Promise<void> { void _id; notImplemented('deleteHonoraire'); }

  // ── Jurisprudence ──────────────────────────────────────────────────────────
  async createJurisprudence(_input: JurisprudenceInput): Promise<JurisprudenceEntry> { void _input; notImplemented('createJurisprudence'); }
  async updateJurisprudence(_id: string, _patch: Partial<JurisprudenceEntry>): Promise<JurisprudenceEntry> { void _id; void _patch; notImplemented('updateJurisprudence'); }
  async deleteJurisprudence(_id: string): Promise<void> { void _id; notImplemented('deleteJurisprudence'); }

  // ── Utilisateurs ───────────────────────────────────────────────────────────
  async createUtilisateur(_input: UtilisateurInput): Promise<Utilisateur> { void _input; notImplemented('createUtilisateur'); }
  async updateUtilisateur(_id: string, _patch: Partial<Utilisateur>): Promise<Utilisateur> { void _id; void _patch; notImplemented('updateUtilisateur'); }
  async deleteUtilisateur(_id: string): Promise<void> { void _id; notImplemented('deleteUtilisateur'); }
  async toggleUtilisateurActive(_id: string): Promise<Utilisateur> { void _id; notImplemented('toggleUtilisateurActive'); }

  /** Sur Dataverse, l'audit est typiquement géré par les fonctionnalités natives
   *  d'auditing de la plateforme (Settings → Auditing). Côté code, ce setter
   *  est un no-op : on s'aligne juste sur le contrat. */
  setCurrentActor(_actor: { id: string; login: string } | null): void { void _actor; }
  /** Pas d'audit local pour Dataverse — la traçabilité est native à la plateforme. */
  getAudit(): JournalAuditEntry[] { return []; }
}
