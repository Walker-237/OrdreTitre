/**
 * Implémentation SharePoint Lists de {@link DataSource} — branche les 11 listes
 * du site `/sites/Audiences` via les services typés générés par
 * `pac code add-data-source` (connecteur `shared_sharepointonline`).
 *
 * ── Conventions de la base SharePoint (issues de l'import CSV) ───────────────
 * Les listes ont été créées par import des CSV de `csv/`. SharePoint a :
 *   - promu la **1ʳᵉ colonne CSV** en colonne primaire **`Title`**,
 *   - nommé les autres colonnes avec des **noms internes génériques**
 *     `field_1, field_2, …` (l'ordre suit les colonnes CSV restantes).
 *
 * La correspondance `field_N → champ métier` est figée dans les schémas
 * `.power/schemas/sharepointonline/<liste>.Schema.json` (propriété `title`).
 * Conséquences exploitées ici :
 *   - Pour la plupart des listes, `Title` porte l'**id métier** (`d-001`, `a-001`…)
 *     → les clés étrangères (`dossierId = "d-001"`) résolvent vers `Title`.
 *   - Pour **Parties** et **Pieces**, `Title` porte le `dossierId` (1ʳᵉ colonne CSV)
 *     et `field_1` porte l'`id` métier (souvent vide → repli sur l'ID SharePoint).
 *
 * Les écritures SharePoint s'adressent par l'**ID numérique natif** de l'élément
 * (`record.ID`), distinct de l'id métier. On maintient donc une table
 * `idMétier → IDSharePoint` ({@link spId}) par entité, alimentée au bootstrap et
 * à chaque création, consultée par update/delete.
 *
 * Limite connue : la liste `Pieces` ne possède de colonnes de rattachement que
 * pour Dossier/Audience/Délibéré. Attacher une pièce à un honoraire, une
 * jurisprudence ou un avocat n'est donc pas persistable → rejet explicite.
 */
import type {
  Agent, Audience, Avocat, Delibere, Dossier, Honoraire,
  Juridiction, JournalAuditEntry, JurisprudenceEntry, Partie, Piece,
  PieceParentType, Utilisateur,
  IssueAudience, NatureProcedure, NiveauJuridiction, QualitePartie, ResultatDelibere,
  Role, SourceAuth, StatutAudience, StatutDelibere, StatutDossier, StatutPaiement,
  TypeAction, TypeAudience, TypeDocument, TypeFrais, TypeJuridiction, TypePartie,
  VoieRecours,
} from '../../models';
import type {
  AgentInput, AudienceInput, AvocatInput, BootstrapData, DataSource,
  DelibereInput, DossierInput, HonoraireInput, JuridictionInput,
  JurisprudenceInput, UtilisateurInput,
} from '../source';
import type { IGetAllOptions } from '../../generated/models/CommonModels';
import type { IOperationResult } from '@microsoft/power-apps/data';
import { AgentsService } from '../../generated/services/AgentsService';
import { AudiencesService } from '../../generated/services/AudiencesService';
import { AvocatsService } from '../../generated/services/AvocatsService';
import { DeliberesService } from '../../generated/services/DeliberesService';
import { DossiersService } from '../../generated/services/DossiersService';
import { HonorairesService } from '../../generated/services/HonorairesService';
import { JuridictionsService } from '../../generated/services/JuridictionsService';
import { JurisprudenceService } from '../../generated/services/JurisprudenceService';
import { PartiesService } from '../../generated/services/PartiesService';
import { PiecesService } from '../../generated/services/PiecesService';
import { UtilisateursService } from '../../generated/services/UtilisateursService';
import { AuditService } from '../../generated/services/AuditService';
import type { AuditAction } from '../../models';

// ─── Types utilitaires ──────────────────────────────────────────────────────
type Rec = Record<string, unknown>;
type SpIdKind =
  | 'dossier' | 'audience' | 'delibere' | 'avocat' | 'agent' | 'juridiction'
  | 'honoraire' | 'jurisprudence' | 'utilisateur' | 'partie' | 'piece';
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyService = {
  getAll: (o?: IGetAllOptions) => Promise<IOperationResult<any>>;
  create: (rec: any) => Promise<IOperationResult<any>>;
  update: (id: string, rec: any) => Promise<IOperationResult<any>>;
  delete: (id: string) => Promise<void>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Coercions de valeurs ───────────────────────────────────────────────────
const firstOf = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
/** Détecte un objet « Personne/Groupe » SharePoint (SPListExpandedUser). */
const isPerson = (o: unknown): o is Record<string, unknown> =>
  !!o && typeof o === 'object' && ('Claims' in o || 'DisplayName' in o || 'Email' in o);
/** Extrait l'e-mail d'un claims `i:0#.f|membership|x@y` le cas échéant. */
const claimsEmail = (c: unknown): string => {
  const tail = (typeof c === 'string' ? c : '').split('|').pop() ?? '';
  return tail.includes('@') ? tail : '';
};
const str = (v: unknown): string => {
  const f = firstOf(v);
  if (isPerson(f)) return String(f.DisplayName ?? f.Email ?? '');
  return f == null ? '' : String(f);
};
/** Colonne « Personne » → adresse e-mail ; sinon valeur texte telle quelle. */
const emailOf = (v: unknown): string => {
  const f = firstOf(v);
  if (isPerson(f)) return String(f.Email || claimsEmail(f.Claims) || f.DisplayName || '');
  return f == null ? '' : String(f);
};
const opt = (v: unknown): string | undefined => {
  const s = str(v).trim();
  return s === '' ? undefined : s;
};
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const optNum = (v: unknown): number | undefined => {
  const s = str(v).trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};
const bool = (v: unknown): boolean =>
  typeof v === 'boolean' ? v : /^(true|1|oui|yes|x)$/i.test(str(v).trim());
/** Choice multi-valeurs : le connecteur peut renvoyer un tableau ou une chaîne. */
const arr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(str).map((s) => s.trim()).filter(Boolean);
  const s = str(v).trim();
  return s === '' ? [] : s.split(/\s*[;,|]\s*/).filter(Boolean);
};
const joinArr = (v: string[] | undefined): string => (v ?? []).join('; ');
const nowIso = (): string => new Date().toISOString();
const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function nextDossierReference(existing: Dossier[]): string {
  const year = new Date().getFullYear();
  const same = existing.filter((d) => d.reference.startsWith(`AFB-${year}-`));
  const lastSeq = same.reduce((max, d) => {
    const n = parseInt(d.reference.split('-').pop() ?? '0', 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `AFB-${year}-${String(lastSeq + 1).padStart(5, '0')}`;
}

const PIECE_FK: Record<PieceParentType, keyof Piece> = {
  DOSSIER: 'dossierId',
  AUDIENCE: 'audienceId',
  DELIBERE: 'delibereId',
  HONORAIRE: 'honoraireId',
  JURISPRUDENCE: 'jurisprudenceId',
  AVOCAT: 'avocatId',
};

export class SharepointDataSource implements DataSource {
  private dossiers: Dossier[] = [];
  private audiences: Audience[] = [];
  private deliberes: Delibere[] = [];
  private avocats: Avocat[] = [];
  private agents: Agent[] = [];
  private juridictions: Juridiction[] = [];
  private honoraires: Honoraire[] = [];
  private jurisprudence: JurisprudenceEntry[] = [];
  private utilisateurs: Utilisateur[] = [];

  /** id métier → ID natif SharePoint, par entité (pour update/delete). */
  private spId = {
    dossier: new Map<string, string>(),
    audience: new Map<string, string>(),
    delibere: new Map<string, string>(),
    avocat: new Map<string, string>(),
    agent: new Map<string, string>(),
    juridiction: new Map<string, string>(),
    honoraire: new Map<string, string>(),
    jurisprudence: new Map<string, string>(),
    utilisateur: new Map<string, string>(),
    partie: new Map<string, string>(),
    piece: new Map<string, string>(),
  };

  // ── Journal d'audit (liste SharePoint `audit`) ─────────────────────────────
  private auditLog: JournalAuditEntry[] = [];
  private currentActor: { id: string; login: string } | null = null;
  private nextAuditId = 1;

  // ── Helpers d'appel générique ──────────────────────────────────────────────
  private async loadAll(svc: AnyService, label: string): Promise<Rec[]> {
    try {
      const res = await svc.getAll({ top: 5000 });
      if (!res.success || !Array.isArray(res.data)) {
        console.warn(`[Sharepoint] chargement « ${label} » échoué`, res.error);
        return [];
      }
      return res.data as Rec[];
    } catch (e) {
      console.warn(`[Sharepoint] chargement « ${label} » a levé une exception`, e);
      return [];
    }
  }
  private async createRec(svc: AnyService, rec: Rec, label: string): Promise<Rec> {
    const res = await svc.create(rec);
    if (!res.success || !res.data) throw new Error(errMsg(res.error, `création ${label}`));
    return res.data as Rec;
  }
  private async updateRec(svc: AnyService, id: string, rec: Rec, label: string): Promise<void> {
    const res = await svc.update(id, rec);
    if (!res.success) throw new Error(errMsg(res.error, `mise à jour ${label}`));
  }

  // ── Bootstrap : lecture + mapping + hydratation ────────────────────────────
  async bootstrap(): Promise<BootstrapData> {
    const [
      dossiersR, audiencesR, deliberesR, avocatsR, agentsR, juridictionsR,
      honorairesR, jurisprudenceR, utilisateursR, partiesR, piecesR,
    ] = await Promise.all([
      this.loadAll(DossiersService, 'Dossiers'),
      this.loadAll(AudiencesService, 'Audiences'),
      this.loadAll(DeliberesService, 'Deliberes'),
      this.loadAll(AvocatsService, 'Avocats'),
      this.loadAll(AgentsService, 'Agents'),
      this.loadAll(JuridictionsService, 'Juridictions'),
      this.loadAll(HonorairesService, 'Honoraires'),
      this.loadAll(JurisprudenceService, 'Jurisprudence'),
      this.loadAll(UtilisateursService, 'Utilisateurs'),
      this.loadAll(PartiesService, 'Parties'),
      this.loadAll(PiecesService, 'Pieces'),
    ]);
    const auditR = await this.loadAll(AuditService, 'audit');

    // Journal d'audit (append-only) — chargé puis trié par horodatage croissant.
    this.auditLog = auditR.map(fromSpAudit).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    this.nextAuditId = this.auditLog.reduce((m, e) => Math.max(m, e.id), 0) + 1;

    this.audiences = audiencesR.map((r) => this.regId('audience', fromSpAudience(r), r));
    this.deliberes = deliberesR.map((r) => this.regId('delibere', fromSpDelibere(r), r));
    this.avocats = avocatsR.map((r) => this.regId('avocat', fromSpAvocat(r), r));
    this.agents = agentsR.map((r) => this.regId('agent', fromSpAgent(r), r));
    this.juridictions = juridictionsR.map((r) => this.regId('juridiction', fromSpJuridiction(r), r));
    this.honoraires = honorairesR.map((r) => this.regId('honoraire', fromSpHonoraire(r), r));
    this.jurisprudence = jurisprudenceR.map((r) => this.regId('jurisprudence', fromSpJurisprudence(r), r));
    this.utilisateurs = utilisateursR.map((r) => this.regId('utilisateur', fromSpUtilisateur(r), r));

    // Parties & pièces : on mappe en conservant le rattachement, + spId.
    const parties = partiesR.map((r) => {
      const p = fromSpPartie(r);
      if (p.id) this.spId.partie.set(p.id, str(r.ID));
      return p;
    });
    const pieces = piecesR.map((r) => {
      const p = fromSpPiece(r);
      if (p.id) this.spId.piece.set(p.id, str(r.ID));
      return p;
    });

    // Dossiers + hydratation parties[] / pieces[] (pièces niveau dossier).
    this.dossiers = dossiersR.map((r) => {
      const d = this.regId('dossier', fromSpDossier(r), r);
      d.parties = parties.filter((p) => p._dossierId === d.id).map(stripPartie);
      d.pieces = pieces
        .filter((p) => p.dossierId === d.id && !p.audienceId && !p.delibereId)
        .map(stripPiece);
      return d;
    });
    // Pièces rattachées aux audiences / délibérés.
    for (const a of this.audiences) {
      a.pieces = pieces.filter((p) => p.audienceId === a.id).map(stripPiece);
    }
    for (const de of this.deliberes) {
      de.pieces = pieces.filter((p) => p.delibereId === de.id).map(stripPiece);
    }

    return {
      dossiers: this.dossiers,
      audiences: this.audiences,
      deliberes: this.deliberes,
      avocats: this.avocats,
      agents: this.agents,
      juridictions: this.juridictions,
      honoraires: this.honoraires,
      jurisprudence: this.jurisprudence,
      utilisateurs: this.utilisateurs,
    };
  }

  /** Enregistre l'association idMétier → IDSharePoint puis renvoie l'entité. */
  private regId<T extends { id: string }>(kind: SpIdKind, m: T, r: Rec): T {
    if (m.id) this.spId[kind].set(m.id, str(r.ID));
    return m;
  }
  private sp(kind: SpIdKind, id: string): string {
    return this.spId[kind].get(id) ?? id;
  }

  // ── Dossiers ───────────────────────────────────────────────────────────────
  async createDossier(input: DossierInput): Promise<Dossier> {
    const id = newId('d');
    const reference = input.reference ?? nextDossierReference(this.dossiers);
    const dossier: Dossier = {
      ...input, id, reference, parties: [], pieces: [], createdAt: nowIso(),
    };
    const r = await this.createRec(DossiersService, toSpDossier(dossier), 'dossier');
    this.spId.dossier.set(id, str(r.ID));

    const parties: Partie[] = [];
    for (const p of input.parties ?? []) {
      const pid = p.id ?? newId('pt');
      const pr = await this.createRec(PartiesService, toSpPartie(p, id, pid), 'partie');
      this.spId.partie.set(pid, str(pr.ID));
      parties.push({ ...p, id: pid });
    }
    const pieces: Piece[] = [];
    for (const pc of input.pieces ?? []) {
      const cid = pc.id ?? newId('pc');
      const cr = await this.createRec(PiecesService, toSpPiece({ ...pc, dossierId: id }, cid), 'pièce');
      this.spId.piece.set(cid, str(cr.ID));
      pieces.push({ ...pc, id: cid, dossierId: id });
    }
    const full = { ...dossier, parties, pieces };
    this.dossiers = [full, ...this.dossiers];
    this.logAudit('CREATE', 'DOSSIER_JUDICIAIRE', full.id, undefined, full);
    return full;
  }

  async updateDossier(id: string, patch: Partial<Dossier>): Promise<Dossier> {
    const cur = this.find(this.dossiers, id);
    await this.updateRec(DossiersService, this.sp('dossier', id), toSpDossier({ ...cur, ...patch, id }), 'dossier');
    let parties = cur.parties;
    if (patch.parties) parties = await this.resyncParties(id, patch.parties);
    const updated: Dossier = { ...cur, ...patch, id, parties, updatedAt: nowIso() };
    this.dossiers = this.dossiers.map((d) => (d.id === id ? updated : d));
    this.logAudit('UPDATE', 'DOSSIER_JUDICIAIRE', id, cur, updated);
    return updated;
  }

  async deleteDossier(id: string): Promise<void> {
    // Cascade : pièces & parties du dossier, puis audiences/délibérés/honoraires liés.
    const doss = this.dossiers.find((d) => d.id === id);
    for (const p of doss?.pieces ?? []) if (p.id) await safeDelete(PiecesService, this.sp('piece', p.id));
    for (const pt of doss?.parties ?? []) if (pt.id) await safeDelete(PartiesService, this.sp('partie', pt.id));
    for (const a of this.audiences.filter((x) => x.dossierId === id)) await safeDelete(AudiencesService, this.sp('audience', a.id));
    for (const de of this.deliberes.filter((x) => x.dossierId === id)) await safeDelete(DeliberesService, this.sp('delibere', de.id));
    for (const h of this.honoraires.filter((x) => x.dossierId === id)) await safeDelete(HonorairesService, this.sp('honoraire', h.id));
    await safeDelete(DossiersService, this.sp('dossier', id));

    this.dossiers = this.dossiers.filter((d) => d.id !== id);
    this.audiences = this.audiences.filter((a) => a.dossierId !== id);
    this.deliberes = this.deliberes.filter((de) => de.dossierId !== id);
    this.honoraires = this.honoraires.filter((h) => h.dossierId !== id);
    if (doss) this.logAudit('DELETE', 'DOSSIER_JUDICIAIRE', id, doss, undefined);
  }

  /** Remplace l'ensemble des parties d'un dossier (delete + recreate). */
  private async resyncParties(dossierId: string, next: Partie[]): Promise<Partie[]> {
    const cur = this.dossiers.find((d) => d.id === dossierId)?.parties ?? [];
    for (const p of cur) if (p.id) await safeDelete(PartiesService, this.sp('partie', p.id));
    const out: Partie[] = [];
    for (const p of next) {
      const pid = p.id ?? newId('pt');
      const pr = await this.createRec(PartiesService, toSpPartie(p, dossierId, pid), 'partie');
      this.spId.partie.set(pid, str(pr.ID));
      out.push({ ...p, id: pid });
    }
    return out;
  }

  // ── Pièces ───────────────────────────────────────────────────────────────
  async addPiece(dossierId: string, piece: Omit<Piece, 'id' | 'createdAt'>): Promise<Dossier> {
    const dossier = this.find(this.dossiers, dossierId);
    const newPiece: Piece = { ...piece, id: newId('pc'), dossierId, createdAt: nowIso() };
    const r = await this.createRec(PiecesService, toSpPiece(newPiece, newPiece.id!), 'pièce');
    this.spId.piece.set(newPiece.id!, str(r.ID));
    const updated = { ...dossier, pieces: [...dossier.pieces, newPiece], updatedAt: nowIso() };
    this.dossiers = this.dossiers.map((d) => (d.id === dossierId ? updated : d));
    this.logAudit('CREATE', 'PIECE', newPiece.id!, undefined, newPiece);
    return updated;
  }

  async removePiece(dossierId: string, pieceId: string): Promise<Dossier> {
    const dossier = this.find(this.dossiers, dossierId);
    const piece = dossier.pieces.find((p) => p.id === pieceId);
    await safeDelete(PiecesService, this.sp('piece', pieceId));
    const updated = {
      ...dossier, pieces: dossier.pieces.filter((p) => p.id !== pieceId), updatedAt: nowIso(),
    };
    this.dossiers = this.dossiers.map((d) => (d.id === dossierId ? updated : d));
    if (piece) this.logAudit('DELETE', 'PIECE', pieceId, piece, undefined);
    return updated;
  }

  async addEntityPiece(
    parentType: PieceParentType, parentId: string, piece: Omit<Piece, 'id' | 'createdAt'>,
  ): Promise<unknown> {
    if (parentType === 'DOSSIER') return this.addPiece(parentId, piece);
    if (parentType !== 'AUDIENCE' && parentType !== 'DELIBERE') {
      throw new Error(
        `Pièce sur ${parentType} non persistable : la liste SharePoint « Pieces » ` +
        `n'a pas de colonne de rattachement pour ce type.`,
      );
    }
    const newPiece: Piece = {
      ...piece, id: newId('pc'), [PIECE_FK[parentType]]: parentId, createdAt: nowIso(),
    };
    const r = await this.createRec(PiecesService, toSpPiece(newPiece, newPiece.id!), 'pièce');
    this.spId.piece.set(newPiece.id!, str(r.ID));
    this.logAudit('CREATE', 'PIECE', newPiece.id!, undefined, newPiece);
    return this.appendEntityPiece(parentType, parentId, newPiece);
  }

  async removeEntityPiece(
    parentType: PieceParentType, parentId: string, pieceId: string,
  ): Promise<unknown> {
    if (parentType === 'DOSSIER') return this.removePiece(parentId, pieceId);
    const arr2 = parentType === 'AUDIENCE' ? this.audiences : this.deliberes;
    const piece = arr2.find((x) => x.id === parentId)?.pieces?.find((p) => p.id === pieceId);
    await safeDelete(PiecesService, this.sp('piece', pieceId));
    if (piece) this.logAudit('DELETE', 'PIECE', pieceId, piece, undefined);
    return this.detachEntityPiece(parentType, parentId, pieceId);
  }

  private appendEntityPiece(t: PieceParentType, parentId: string, piece: Piece): unknown {
    const apply = <T extends { id: string; pieces?: Piece[] }>(arr2: T[]): T[] =>
      arr2.map((x) => (x.id === parentId ? { ...x, pieces: [...(x.pieces ?? []), piece] } : x));
    if (t === 'AUDIENCE') { this.audiences = apply(this.audiences); return this.audiences.find((x) => x.id === parentId); }
    this.deliberes = apply(this.deliberes); return this.deliberes.find((x) => x.id === parentId);
  }
  private detachEntityPiece(t: PieceParentType, parentId: string, pieceId: string): unknown {
    const apply = <T extends { id: string; pieces?: Piece[] }>(arr2: T[]): T[] =>
      arr2.map((x) => (x.id === parentId ? { ...x, pieces: (x.pieces ?? []).filter((p) => p.id !== pieceId) } : x));
    if (t === 'AUDIENCE') { this.audiences = apply(this.audiences); return this.audiences.find((x) => x.id === parentId); }
    this.deliberes = apply(this.deliberes); return this.deliberes.find((x) => x.id === parentId);
  }

  // ── Audiences ──────────────────────────────────────────────────────────────
  async createAudience(input: AudienceInput): Promise<Audience> {
    const id = newId('a');
    const m: Audience = { ...input, id, createdAt: nowIso() };
    const r = await this.createRec(AudiencesService, toSpAudience(m), 'audience');
    this.spId.audience.set(id, str(r.ID));
    this.audiences = [m, ...this.audiences];
    this.logAudit('CREATE', 'AUDIENCE', m.id, undefined, m);
    return m;
  }
  async updateAudience(id: string, patch: Partial<Audience>): Promise<Audience> {
    const cur = this.find(this.audiences, id);
    await this.updateRec(AudiencesService, this.sp('audience', id), toSpAudience({ ...cur, ...patch, id }), 'audience');
    const updated = { ...cur, ...patch, id, updatedAt: nowIso() };
    this.audiences = this.audiences.map((a) => (a.id === id ? updated : a));
    this.logAudit('UPDATE', 'AUDIENCE', id, cur, updated);
    return updated;
  }
  async deleteAudience(id: string): Promise<void> {
    const before = this.audiences.find((a) => a.id === id);
    await safeDelete(AudiencesService, this.sp('audience', id));
    this.audiences = this.audiences.filter((a) => a.id !== id);
    if (before) this.logAudit('DELETE', 'AUDIENCE', id, before, undefined);
  }

  // ── Délibérés ──────────────────────────────────────────────────────────────
  async createDelibere(input: DelibereInput): Promise<Delibere> {
    const id = newId('de');
    const m: Delibere = { ...input, id, createdAt: nowIso() };
    const r = await this.createRec(DeliberesService, toSpDelibere(m), 'délibéré');
    this.spId.delibere.set(id, str(r.ID));
    this.deliberes = [m, ...this.deliberes];
    this.logAudit('CREATE', 'DELIBERE', m.id, undefined, m);
    return m;
  }
  async updateDelibere(id: string, patch: Partial<Delibere>): Promise<Delibere> {
    const cur = this.find(this.deliberes, id);
    await this.updateRec(DeliberesService, this.sp('delibere', id), toSpDelibere({ ...cur, ...patch, id }), 'délibéré');
    const updated = { ...cur, ...patch, id, updatedAt: nowIso() };
    this.deliberes = this.deliberes.map((d) => (d.id === id ? updated : d));
    this.logAudit('UPDATE', 'DELIBERE', id, cur, updated);
    return updated;
  }
  async deleteDelibere(id: string): Promise<void> {
    const before = this.deliberes.find((d) => d.id === id);
    await safeDelete(DeliberesService, this.sp('delibere', id));
    this.deliberes = this.deliberes.filter((d) => d.id !== id);
    if (before) this.logAudit('DELETE', 'DELIBERE', id, before, undefined);
  }

  // ── Avocats ────────────────────────────────────────────────────────────────
  async createAvocat(input: AvocatInput): Promise<Avocat> {
    const id = newId('av');
    const m: Avocat = { ...input, id, createdAt: nowIso() };
    const r = await this.createRec(AvocatsService, toSpAvocat(m), 'avocat');
    this.spId.avocat.set(id, str(r.ID));
    this.avocats = [m, ...this.avocats];
    this.logAudit('CREATE', 'AVOCAT', m.id, undefined, m);
    return m;
  }
  async updateAvocat(id: string, patch: Partial<Avocat>): Promise<Avocat> {
    const cur = this.find(this.avocats, id);
    await this.updateRec(AvocatsService, this.sp('avocat', id), toSpAvocat({ ...cur, ...patch, id }), 'avocat');
    const updated = { ...cur, ...patch, id, updatedAt: nowIso() };
    this.avocats = this.avocats.map((a) => (a.id === id ? updated : a));
    this.logAudit('UPDATE', 'AVOCAT', id, cur, updated);
    return updated;
  }
  async deleteAvocat(id: string): Promise<void> {
    const before = this.avocats.find((a) => a.id === id);
    await safeDelete(AvocatsService, this.sp('avocat', id));
    this.avocats = this.avocats.filter((a) => a.id !== id);
    if (before) this.logAudit('DELETE', 'AVOCAT', id, before, undefined);
  }

  // ── Agents ─────────────────────────────────────────────────────────────────
  async createAgent(input: AgentInput): Promise<Agent> {
    const id = newId('ag');
    const m: Agent = { ...input, id, createdAt: nowIso() };
    const r = await this.createRec(AgentsService, toSpAgent(m), 'agent');
    this.spId.agent.set(id, str(r.ID));
    this.agents = [m, ...this.agents];
    this.logAudit('CREATE', 'AGENT', m.id, undefined, m);
    return m;
  }
  async updateAgent(id: string, patch: Partial<Agent>): Promise<Agent> {
    const cur = this.find(this.agents, id);
    await this.updateRec(AgentsService, this.sp('agent', id), toSpAgent({ ...cur, ...patch, id }), 'agent');
    const updated = { ...cur, ...patch, id };
    this.agents = this.agents.map((a) => (a.id === id ? updated : a));
    this.logAudit('UPDATE', 'AGENT', id, cur, updated);
    return updated;
  }
  async deleteAgent(id: string): Promise<void> {
    const before = this.agents.find((a) => a.id === id);
    await safeDelete(AgentsService, this.sp('agent', id));
    this.agents = this.agents.filter((a) => a.id !== id);
    if (before) this.logAudit('DELETE', 'AGENT', id, before, undefined);
  }

  // ── Juridictions ───────────────────────────────────────────────────────────
  async createJuridiction(input: JuridictionInput): Promise<Juridiction> {
    const id = newId('jur');
    const m: Juridiction = { ...input, id };
    const r = await this.createRec(JuridictionsService, toSpJuridiction(m), 'juridiction');
    this.spId.juridiction.set(id, str(r.ID));
    this.juridictions = [m, ...this.juridictions];
    this.logAudit('CREATE', 'JURIDICTION', m.id, undefined, m);
    return m;
  }
  async updateJuridiction(id: string, patch: Partial<Juridiction>): Promise<Juridiction> {
    const cur = this.find(this.juridictions, id);
    await this.updateRec(JuridictionsService, this.sp('juridiction', id), toSpJuridiction({ ...cur, ...patch, id }), 'juridiction');
    const updated = { ...cur, ...patch, id };
    this.juridictions = this.juridictions.map((j) => (j.id === id ? updated : j));
    this.logAudit('UPDATE', 'JURIDICTION', id, cur, updated);
    return updated;
  }
  async deleteJuridiction(id: string): Promise<void> {
    const before = this.juridictions.find((j) => j.id === id);
    await safeDelete(JuridictionsService, this.sp('juridiction', id));
    this.juridictions = this.juridictions.filter((j) => j.id !== id);
    if (before) this.logAudit('DELETE', 'JURIDICTION', id, before, undefined);
  }

  // ── Honoraires ─────────────────────────────────────────────────────────────
  async createHonoraire(input: HonoraireInput): Promise<Honoraire> {
    const id = newId('h');
    const m: Honoraire = { ...input, id, createdAt: nowIso() };
    const r = await this.createRec(HonorairesService, toSpHonoraire(m), 'honoraire');
    this.spId.honoraire.set(id, str(r.ID));
    this.honoraires = [m, ...this.honoraires];
    this.logAudit('CREATE', 'HONORAIRE', m.id, undefined, m);
    return m;
  }
  async updateHonoraire(id: string, patch: Partial<Honoraire>): Promise<Honoraire> {
    const cur = this.find(this.honoraires, id);
    await this.updateRec(HonorairesService, this.sp('honoraire', id), toSpHonoraire({ ...cur, ...patch, id }), 'honoraire');
    const updated = { ...cur, ...patch, id };
    this.honoraires = this.honoraires.map((h) => (h.id === id ? updated : h));
    this.logAudit('UPDATE', 'HONORAIRE', id, cur, updated);
    return updated;
  }
  async deleteHonoraire(id: string): Promise<void> {
    const before = this.honoraires.find((h) => h.id === id);
    await safeDelete(HonorairesService, this.sp('honoraire', id));
    this.honoraires = this.honoraires.filter((h) => h.id !== id);
    if (before) this.logAudit('DELETE', 'HONORAIRE', id, before, undefined);
  }

  // ── Jurisprudence ──────────────────────────────────────────────────────────
  async createJurisprudence(input: JurisprudenceInput): Promise<JurisprudenceEntry> {
    const id = newId('jp');
    const m: JurisprudenceEntry = { ...input, id, createdAt: nowIso() };
    const r = await this.createRec(JurisprudenceService, toSpJurisprudence(m), 'jurisprudence');
    this.spId.jurisprudence.set(id, str(r.ID));
    this.jurisprudence = [m, ...this.jurisprudence];
    this.logAudit('CREATE', 'JURISPRUDENCE', m.id, undefined, m);
    return m;
  }
  async updateJurisprudence(id: string, patch: Partial<JurisprudenceEntry>): Promise<JurisprudenceEntry> {
    const cur = this.find(this.jurisprudence, id);
    await this.updateRec(JurisprudenceService, this.sp('jurisprudence', id), toSpJurisprudence({ ...cur, ...patch, id }), 'jurisprudence');
    const updated = { ...cur, ...patch, id };
    this.jurisprudence = this.jurisprudence.map((j) => (j.id === id ? updated : j));
    this.logAudit('UPDATE', 'JURISPRUDENCE', id, cur, updated);
    return updated;
  }
  async deleteJurisprudence(id: string): Promise<void> {
    const before = this.jurisprudence.find((j) => j.id === id);
    await safeDelete(JurisprudenceService, this.sp('jurisprudence', id));
    this.jurisprudence = this.jurisprudence.filter((j) => j.id !== id);
    if (before) this.logAudit('DELETE', 'JURISPRUDENCE', id, before, undefined);
  }

  // ── Utilisateurs ───────────────────────────────────────────────────────────
  async createUtilisateur(input: UtilisateurInput): Promise<Utilisateur> {
    const id = newId('u');
    const m: Utilisateur = { ...input, id, createdAt: nowIso() };
    const r = await this.createRec(UtilisateursService, toSpUtilisateur(m), 'utilisateur');
    this.spId.utilisateur.set(id, str(r.ID));
    this.utilisateurs = [m, ...this.utilisateurs];
    this.logAudit('CREATE', 'UTILISATEUR', m.id, undefined, m);
    return m;
  }
  async updateUtilisateur(id: string, patch: Partial<Utilisateur>): Promise<Utilisateur> {
    const cur = this.find(this.utilisateurs, id);
    await this.updateRec(UtilisateursService, this.sp('utilisateur', id), toSpUtilisateur({ ...cur, ...patch, id }), 'utilisateur');
    const updated = { ...cur, ...patch, id };
    this.utilisateurs = this.utilisateurs.map((u) => (u.id === id ? updated : u));
    this.logAudit('UPDATE', 'UTILISATEUR', id, cur, updated);
    return updated;
  }
  async deleteUtilisateur(id: string): Promise<void> {
    const before = this.utilisateurs.find((u) => u.id === id);
    await safeDelete(UtilisateursService, this.sp('utilisateur', id));
    this.utilisateurs = this.utilisateurs.filter((u) => u.id !== id);
    if (before) this.logAudit('DELETE', 'UTILISATEUR', id, before, undefined);
  }
  async toggleUtilisateurActive(id: string): Promise<Utilisateur> {
    const u = this.find(this.utilisateurs, id);
    return this.updateUtilisateur(id, { isActive: !u.isActive });
  }

  // ── Journal d'audit (liste SharePoint `audit`, append-only) ────────────────
  setCurrentActor(actor: { id: string; login: string } | null): void {
    this.currentActor = actor;
  }
  getAudit(): JournalAuditEntry[] { return this.auditLog; }

  /**
   * Ajoute une entrée d'audit : pousse en mémoire (immédiat) puis écrit la ligne
   * dans la liste SharePoint (best-effort, non bloquant). Le contenu binaire des
   * pièces est exclu en amont par les appelants.
   */
  private logAudit(
    action: AuditAction, entiteCible: string, idEntiteCible: string,
    before: object | undefined, after: object | undefined,
  ): void {
    const entry: JournalAuditEntry = {
      id: this.nextAuditId++,
      utilisateurId: this.currentActor?.id ?? 'system',
      utilisateurLogin: this.currentActor?.login ?? 'system',
      action, entiteCible, idEntiteCible,
      valeurAvant: before ? serializeForAudit(before) : undefined,
      valeurApres: after ? serializeForAudit(after) : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: nowIso(),
    };
    this.auditLog = [...this.auditLog, entry];
    // Écriture distante non bloquante (l'UI ne doit pas attendre l'audit).
    void AuditService.create(toSpAudit(entry) as never).catch((e) => {
      console.warn('[Sharepoint] écriture audit échouée', e);
    });
  }

  private find<T extends { id: string }>(arr2: T[], id: string): T {
    const found = arr2.find((x) => x.id === id);
    if (!found) throw new Error(`Entité ${id} introuvable`);
    return found;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Mappers SharePoint ↔ modèle  (field_N ⇄ champ métier, cf. schémas .power)
// ════════════════════════════════════════════════════════════════════════════

function errMsg(e: unknown, ctx: string): string {
  const m = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
  return `Échec ${ctx} (SharePoint)${m ? ` : ${m}` : ''}`;
}
async function safeDelete(svc: AnyService, id: string): Promise<void> {
  try { await svc.delete(id); }
  catch (e) { console.warn('[Sharepoint] delete', id, e); }
}

/**
 * Sérialise un objet pour l'audit : les longues chaînes (pièces jointes base64)
 * sont omises, et le tout est tronqué à 500 caractères.
 */
function serializeForAudit(obj: object): string {
  try {
    const s = JSON.stringify(obj, (_k, v) =>
      (typeof v === 'string' && v.length > 200 ? '<omitted>' : v));
    return s.length > 500 ? s.slice(0, 497) + '…' : s;
  } catch {
    return '<serialization error>';
  }
}

// ── Audit ─ Title=id ; field_1..10 ──────────────────────────────────────────
function fromSpAudit(r: Rec): JournalAuditEntry {
  const idNum = Number(str(r.Title));
  return {
    id: Number.isFinite(idNum) && idNum > 0 ? idNum : Number(str(r.ID)) || 0,
    utilisateurId: str(r.field_1),
    utilisateurLogin: str(r.field_2),
    action: (opt(r.field_3) ?? 'UPDATE') as AuditAction,
    entiteCible: str(r.field_4),
    idEntiteCible: str(r.field_5),
    valeurAvant: opt(r.field_6),
    valeurApres: opt(r.field_7),
    ipAdresse: opt(r.field_8),
    userAgent: opt(r.field_9),
    timestamp: opt(r.field_10) ?? str(r.Created),
  };
}
function toSpAudit(a: JournalAuditEntry): Rec {
  return {
    Title: String(a.id),
    field_1: a.utilisateurId, field_2: a.utilisateurLogin, field_3: a.action,
    field_4: a.entiteCible, field_5: a.idEntiteCible, field_6: a.valeurAvant ?? '',
    field_7: a.valeurApres ?? '', field_8: a.ipAdresse ?? '', field_9: a.userAgent ?? '',
    field_10: a.timestamp,
  };
}


// ── Dossier ─ Title=id ; field_1..28 ────────────────────────────────────────
function fromSpDossier(r: Rec): Dossier {
  return {
    id: str(r.Title),
    reference: str(r.field_1),
    intitule: str(r.field_2),
    nature: (opt(r.field_3) ?? 'AUTRE') as NatureProcedure,
    sousNature: str(r.field_4),
    typeAction: (opt(r.field_5) ?? 'DEMANDEUR') as TypeAction,
    juridictionId: opt(r.field_6),
    juridiction: str(r.field_7),
    ville: str(r.field_8),
    montantEnJeu: num(r.field_9),
    devise: opt(r.field_10) ?? 'XAF',
    statut: (opt(r.field_11) ?? 'OUVERT') as StatutDossier,
    agentId: opt(r.field_12),
    agent: str(r.field_13),
    avocatId: opt(r.field_14),
    avocat: str(r.field_15),
    dateOuverture: str(r.field_16),
    dateCloture: opt(r.field_17),
    dateArchivage: opt(r.field_18),
    prochaineEcheance: str(r.field_19),
    progress: num(r.field_20),
    risque: (opt(r.field_21) ?? 'MOYEN') as Dossier['risque'],
    resumeFaits: opt(r.field_22),
    observations: opt(r.field_23),
    parties: [],
    pieces: [],
    createdBy: opt(r.field_24),
    createdAt: opt(r.field_25) ?? str(r.Created),
    updatedBy: opt(r.field_26),
    updatedAt: opt(r.field_27) ?? str(r.Modified),
    isDeleted: bool(r.field_28),
  };
}
function toSpDossier(d: Dossier): Rec {
  return {
    Title: d.id,
    field_1: d.reference, field_2: d.intitule, field_3: d.nature, field_4: d.sousNature,
    field_5: d.typeAction, field_6: d.juridictionId ?? '', field_7: d.juridiction, field_8: d.ville,
    field_9: d.montantEnJeu, field_10: d.devise, field_11: d.statut, field_12: d.agentId ?? '',
    field_13: d.agent, field_14: d.avocatId ?? '', field_15: d.avocat, field_16: d.dateOuverture,
    field_17: d.dateCloture ?? '', field_18: d.dateArchivage ?? '', field_19: d.prochaineEcheance,
    field_20: d.progress, field_21: d.risque, field_22: d.resumeFaits ?? '', field_23: d.observations ?? '',
    field_24: d.createdBy ?? '', field_25: d.createdAt ?? '', field_26: d.updatedBy ?? '',
    field_27: d.updatedAt ?? '', field_28: String(d.isDeleted ?? false),
  };
}

// ── Audience ─ Title=id ; field_1..22 ───────────────────────────────────────
function fromSpAudience(r: Rec): Audience {
  return {
    id: str(r.Title),
    dossierId: str(r.field_1),
    date: str(r.field_2),
    heure: str(r.field_3),
    dateTenueEffective: opt(r.field_4),
    statut: (opt(r.field_5) ?? 'PLANIFIEE') as StatutAudience,
    typeAudience: (opt(r.field_6) ?? 'MISE_EN_ETAT') as TypeAudience,
    juridictionId: opt(r.field_7),
    juridiction: str(r.field_8),
    numeroRole: opt(r.field_9),
    salleAudience: opt(r.field_10),
    agentId: opt(r.field_11),
    agent: str(r.field_12),
    avocatId: opt(r.field_13),
    objet: str(r.field_14),
    compteRendu: opt(r.field_15),
    issueAudience: opt(r.field_16) as IssueAudience | undefined,
    dateRenvoi: opt(r.field_17),
    piecesDeposees: opt(r.field_18),
    rappelEnvoye: bool(r.field_19),
    pieces: [],
    createdBy: opt(r.field_20),
    createdAt: opt(r.field_21) ?? str(r.Created),
    updatedAt: opt(r.field_22) ?? str(r.Modified),
  };
}
function toSpAudience(a: Audience): Rec {
  return {
    Title: a.id,
    field_1: a.dossierId, field_2: a.date, field_3: a.heure, field_4: a.dateTenueEffective ?? '',
    field_5: a.statut, field_6: a.typeAudience, field_7: a.juridictionId ?? '', field_8: a.juridiction,
    field_9: a.numeroRole ?? '', field_10: a.salleAudience ?? '', field_11: a.agentId ?? '', field_12: a.agent,
    field_13: a.avocatId ?? '', field_14: a.objet, field_15: a.compteRendu ?? '', field_16: a.issueAudience ?? '',
    field_17: a.dateRenvoi ?? '', field_18: a.piecesDeposees ?? '', field_19: String(a.rappelEnvoye),
    field_20: a.createdBy ?? '', field_21: a.createdAt ?? '', field_22: a.updatedAt ?? '',
  };
}

// ── Délibéré ─ Title=id ; field_1..22 ───────────────────────────────────────
function fromSpDelibere(r: Rec): Delibere {
  return {
    id: str(r.Title),
    dossierId: str(r.field_1),
    audienceOrigineId: opt(r.field_2),
    dateDelibere: str(r.field_3),
    dateDelibereEffectif: opt(r.field_4),
    statut: (opt(r.field_5) ?? 'EN_ATTENTE') as StatutDelibere,
    resultat: opt(r.field_6) as ResultatDelibere | undefined,
    dispositif: opt(r.field_7),
    decision: opt(r.field_8),
    montantAccorde: optNum(r.field_9),
    montantCondamne: optNum(r.field_10),
    voiesRecours: arr(r.field_11) as VoieRecours[],
    dateLimiteRecours: opt(r.field_12),
    recoursExerce: bool(r.field_13),
    typeRecoursExerce: opt(r.field_14) as VoieRecours | undefined,
    dateExerciceRecours: opt(r.field_15),
    grosseLevee: bool(r.field_16),
    dateLeveeGrosse: opt(r.field_17),
    agentSuiviId: opt(r.field_18),
    observations: opt(r.field_19),
    pieces: [],
    createdBy: opt(r.field_20),
    createdAt: opt(r.field_21) ?? str(r.Created),
    updatedAt: opt(r.field_22) ?? str(r.Modified),
  };
}
function toSpDelibere(d: Delibere): Rec {
  return {
    Title: d.id,
    field_1: d.dossierId, field_2: d.audienceOrigineId ?? '', field_3: d.dateDelibere,
    field_4: d.dateDelibereEffectif ?? '', field_5: d.statut, field_6: d.resultat ?? '',
    field_7: d.dispositif ?? '', field_8: d.decision ?? '', field_9: d.montantAccorde ?? '',
    field_10: d.montantCondamne ?? '', field_11: joinArr(d.voiesRecours), field_12: d.dateLimiteRecours ?? '',
    field_13: String(d.recoursExerce), field_14: d.typeRecoursExerce ?? '', field_15: d.dateExerciceRecours ?? '',
    field_16: String(d.grosseLevee), field_17: d.dateLeveeGrosse ?? '', field_18: d.agentSuiviId ?? '',
    field_19: d.observations ?? '', field_20: d.createdBy ?? '', field_21: d.createdAt ?? '',
    field_22: d.updatedAt ?? '',
  };
}

// ── Avocat ─ Title=id ; field_1..21 ─────────────────────────────────────────
function fromSpAvocat(r: Rec): Avocat {
  return {
    id: str(r.Title),
    utilisateurId: opt(r.field_1),
    nom: str(r.field_2),
    prenom: opt(r.field_3),
    cabinet: str(r.field_4),
    numeroBarreau: opt(r.field_5),
    barreau: opt(r.field_6),
    specialites: arr(r.field_7),
    telephone: str(r.field_8),
    telephoneSecondaire: opt(r.field_9),
    email: emailOf(r.field_10),
    adresse: opt(r.field_11),
    ville: str(r.field_12),
    seuilDossiersMax: num(r.field_13),
    dossiersActifs: num(r.field_14),
    taux: num(r.field_15),
    honoraires: num(r.field_16),
    isActive: bool(r.field_17),
    dateDebutCollaboration: opt(r.field_18),
    notes: opt(r.field_19),
    pieces: [],
    createdAt: opt(r.field_20) ?? str(r.Created),
    updatedAt: opt(r.field_21) ?? str(r.Modified),
  };
}
function toSpAvocat(a: Avocat): Rec {
  return {
    Title: a.id,
    field_1: a.utilisateurId ?? '', field_2: a.nom, field_3: a.prenom ?? '', field_4: a.cabinet,
    field_5: a.numeroBarreau ?? '', field_6: a.barreau ?? '', field_7: joinArr(a.specialites),
    field_8: a.telephone, field_9: a.telephoneSecondaire ?? '', field_11: a.adresse ?? '',
    field_12: a.ville, field_13: a.seuilDossiersMax, field_14: a.dossiersActifs, field_15: a.taux,
    field_16: a.honoraires, field_17: String(a.isActive), field_18: a.dateDebutCollaboration ?? '',
    field_19: a.notes ?? '', field_20: a.createdAt ?? '', field_21: a.updatedAt ?? '',
  };
}

// ── Agent ─ Title=id ; field_1..16 ──────────────────────────────────────────
function fromSpAgent(r: Rec): Agent {
  return {
    id: str(r.Title),
    utilisateurId: opt(r.field_1),
    matricule: opt(r.field_2),
    nom: str(r.field_3),
    prenom: opt(r.field_4),
    poste: str(r.field_5),
    fonction: str(r.field_6),
    direction: str(r.field_7),
    telephone: str(r.field_8),
    email: emailOf(r.field_9),
    dossiers: num(r.field_10),
    audiences: num(r.field_11),
    taux: num(r.field_12),
    isActive: bool(r.field_13),
    datePriseFonction: opt(r.field_14),
    notes: opt(r.field_15),
    createdAt: opt(r.field_16) ?? str(r.Created),
  };
}
function toSpAgent(a: Agent): Rec {
  return {
    Title: a.id,
    field_1: a.utilisateurId ?? '', field_2: a.matricule ?? '', field_3: a.nom, field_4: a.prenom ?? '',
    field_5: a.poste, field_6: a.fonction, field_7: a.direction, field_8: a.telephone,
    field_10: a.dossiers, field_11: a.audiences, field_12: a.taux, field_13: String(a.isActive),
    field_14: a.datePriseFonction ?? '', field_15: a.notes ?? '', field_16: a.createdAt ?? '',
  };
}

// ── Juridiction ─ Title=id ; field_1..10 ────────────────────────────────────
function fromSpJuridiction(r: Rec): Juridiction {
  return {
    id: str(r.Title),
    libelle: str(r.field_1),
    typeJuridiction: (opt(r.field_2) ?? 'AUTRE') as TypeJuridiction,
    niveau: (opt(r.field_3) ?? 'PREMIER_DEGRE') as NiveauJuridiction,
    ville: str(r.field_4),
    pays: str(r.field_5),
    adresse: opt(r.field_6),
    telephone: opt(r.field_7),
    emailGreffe: opt(r.field_8),
    isActive: bool(r.field_9),
    notes: opt(r.field_10),
  };
}
function toSpJuridiction(j: Juridiction): Rec {
  return {
    Title: j.id,
    field_1: j.libelle, field_2: j.typeJuridiction, field_3: j.niveau, field_4: j.ville, field_5: j.pays,
    field_6: j.adresse ?? '', field_7: j.telephone ?? '', field_8: j.emailGreffe ?? '',
    field_9: String(j.isActive), field_10: j.notes ?? '',
  };
}

// ── Honoraire ─ Title=id ; field_1..15 ──────────────────────────────────────
function fromSpHonoraire(r: Rec): Honoraire {
  return {
    id: str(r.Title),
    dossierId: str(r.field_1),
    avocatId: str(r.field_2),
    referenceFacture: opt(r.field_3),
    typeFrais: (opt(r.field_4) ?? 'AUTRE') as TypeFrais,
    montantFacture: num(r.field_5),
    montantValide: optNum(r.field_6),
    montantPaye: num(r.field_7),
    statutPaiement: (opt(r.field_8) ?? 'EN_ATTENTE') as StatutPaiement,
    dateFacture: str(r.field_9),
    dateValidation: opt(r.field_10),
    datePaiement: opt(r.field_11),
    validateurId: opt(r.field_12),
    pieceJointeUrl: opt(r.field_13),
    observations: opt(r.field_14),
    pieces: [],
    createdAt: opt(r.field_15) ?? str(r.Created),
  };
}
function toSpHonoraire(h: Honoraire): Rec {
  return {
    Title: h.id,
    field_1: h.dossierId, field_2: h.avocatId, field_3: h.referenceFacture ?? '', field_4: h.typeFrais,
    field_5: h.montantFacture, field_6: h.montantValide ?? '', field_7: h.montantPaye, field_8: h.statutPaiement,
    field_9: h.dateFacture, field_10: h.dateValidation ?? '', field_11: h.datePaiement ?? '',
    field_12: h.validateurId ?? '', field_13: h.pieceJointeUrl ?? '', field_14: h.observations ?? '',
    field_15: h.createdAt ?? '',
  };
}

// ── Jurisprudence ─ Title=id ; field_1..16 ──────────────────────────────────
function fromSpJurisprudence(r: Rec): JurisprudenceEntry {
  return {
    id: str(r.Title),
    delibereId: opt(r.field_1),
    dossierId: opt(r.field_2),
    juridictionId: opt(r.field_3),
    reference: str(r.field_4),
    date: str(r.field_5),
    juridiction: str(r.field_6),
    matiere: (opt(r.field_7) ?? 'AUTRE') as NatureProcedure,
    titre: opt(r.field_8),
    resume: str(r.field_9),
    dispositif: opt(r.field_10),
    motsCles: arr(r.field_11),
    annotations: opt(r.field_12),
    fichierUrl: opt(r.field_13),
    pieces: [],
    isPubliable: bool(r.field_14),
    createdBy: opt(r.field_15),
    createdAt: opt(r.field_16) ?? str(r.Created),
  };
}
function toSpJurisprudence(j: JurisprudenceEntry): Rec {
  return {
    Title: j.id,
    field_1: j.delibereId ?? '', field_2: j.dossierId ?? '', field_3: j.juridictionId ?? '',
    field_4: j.reference, field_5: j.date, field_6: j.juridiction, field_7: j.matiere, field_8: j.titre ?? '',
    field_9: j.resume, field_10: j.dispositif ?? '', field_11: joinArr(j.motsCles), field_12: j.annotations ?? '',
    field_13: j.fichierUrl ?? '', field_14: String(j.isPubliable), field_15: j.createdBy ?? '',
    field_16: j.createdAt ?? '',
  };
}

// ── Utilisateur ─ Title=id ; field_1..8 ─────────────────────────────────────
function fromSpUtilisateur(r: Rec): Utilisateur {
  return {
    id: str(r.Title),
    login: str(r.field_1),
    nomAffichage: str(r.field_2),
    email: emailOf(r.field_3),
    role: (opt(r.field_4) ?? 'LECTEUR') as Role,
    isActive: bool(r.field_5),
    sourceAuth: (opt(r.field_6) ?? 'LOCAL') as SourceAuth,
    derniereConnexion: opt(r.field_7),
    createdAt: opt(r.field_8) ?? str(r.Created),
  };
}
function toSpUtilisateur(u: Utilisateur): Rec {
  // field_3 (email) = colonne « Personne » SharePoint, lecture seule depuis
  // l'annuaire → on ne l'écrit pas (un string y serait rejeté).
  return {
    Title: u.id,
    field_1: u.login, field_2: u.nomAffichage, field_4: u.role,
    field_5: String(u.isActive), field_6: u.sourceAuth, field_7: u.derniereConnexion ?? '',
    field_8: u.createdAt ?? '',
  };
}

// ── Partie ─ Title=dossierId ; field_1=id ; field_2..12 ─────────────────────
type SpPartie = Partie & { _dossierId: string };
function fromSpPartie(r: Rec): SpPartie {
  return {
    _dossierId: str(r.Title),
    id: opt(r.field_1) ?? str(r.ID),
    typePartie: (opt(r.field_2) ?? 'PERSONNE_MORALE') as TypePartie,
    nomRaisonSociale: str(r.field_3),
    prenom: opt(r.field_4),
    numeroCniRccm: opt(r.field_5),
    nationalite: opt(r.field_6),
    adresse: opt(r.field_7),
    telephone: opt(r.field_8),
    email: opt(r.field_9),
    qualiteDansDossier: (opt(r.field_10) ?? 'AUTRE') as QualitePartie,
    observations: opt(r.field_11),
    createdAt: opt(r.field_12) ?? str(r.Created),
  };
}
function stripPartie(p: SpPartie): Partie {
  const { _dossierId, ...rest } = p;
  void _dossierId;
  return rest;
}
function toSpPartie(p: Partie, dossierId: string, id: string): Rec {
  return {
    Title: dossierId,
    field_1: id, field_2: p.typePartie, field_3: p.nomRaisonSociale, field_4: p.prenom ?? '',
    field_5: p.numeroCniRccm ?? '', field_6: p.nationalite ?? '', field_7: p.adresse ?? '',
    field_8: p.telephone ?? '', field_9: p.email ?? '', field_10: p.qualiteDansDossier,
    field_11: p.observations ?? '', field_12: p.createdAt ?? '',
  };
}

// ── Pièce ─ Title=dossierId ; field_1=id ; field_2..13 ──────────────────────
function fromSpPiece(r: Rec): Piece {
  return {
    id: opt(r.field_1) ?? str(r.ID),
    dossierId: opt(r.Title),
    libelle: str(r.field_2),
    typeDocument: (opt(r.field_3) ?? 'AUTRE') as TypeDocument,
    dateDocument: opt(r.field_4),
    fichierNom: str(r.field_5),
    fichierUrl: opt(r.field_6),
    mimeType: opt(r.field_7),
    tailleOctets: optNum(r.field_8),
    estConfidentiel: bool(r.field_9),
    uploadedBy: opt(r.field_10),
    audienceId: opt(r.field_11),
    delibereId: opt(r.field_12),
    createdAt: opt(r.field_13) ?? str(r.Created),
  };
}
function stripPiece(p: Piece): Piece { return p; }
function toSpPiece(p: Piece, id: string): Rec {
  return {
    Title: p.dossierId ?? '',
    field_1: id, field_2: p.libelle, field_3: p.typeDocument, field_4: p.dateDocument ?? '',
    field_5: p.fichierNom, field_6: p.fichierUrl ?? '', field_7: p.mimeType ?? '',
    field_8: p.tailleOctets ?? '', field_9: String(p.estConfidentiel), field_10: p.uploadedBy ?? '',
    field_11: p.audienceId ?? '', field_12: p.delibereId ?? '', field_13: p.createdAt ?? '',
  };
}
