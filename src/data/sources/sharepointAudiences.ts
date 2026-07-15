/**
 * Source de données **hybride** : les *audiences* proviennent de la liste
 * SharePoint « Audiences » (connecteur `shared_sharepointonline`, service typé
 * généré par `pac code add-data-source`), tout le reste (dossiers, délibérés,
 * avocats, …) reste servi par {@link SeedDataSource}.
 *
 * Objectif : valider l'intégration SharePoint de bout en bout sur une seule
 * liste avant de basculer toutes les entités (cf. SHAREPOINT.md). On surcharge
 * uniquement `bootstrap()` (pour les audiences) et le CRUD audiences.
 *
 * ── Mapping colonnes SharePoint ↔ modèle ───────────────────────────────────
 * La liste a été créée par import CSV : SharePoint a conservé les libellés
 * métier en *nom d'affichage* mais a attribué des **noms internes génériques**
 * `field_1..field_22`. La correspondance ci-dessous est extraite du schéma
 * `.power/schemas/sharepointonline/audiences.Schema.json` (propriété `title`).
 *
 *   field_1  dossierId          field_12 agent
 *   field_2  date               field_13 avocatId
 *   field_3  heure              field_14 objet
 *   field_4  dateTenueEffective field_15 compteRendu
 *   field_5  statut             field_16 issueAudience
 *   field_6  typeAudience       field_17 dateRenvoi
 *   field_7  juridictionId      field_18 piecesDeposees
 *   field_8  juridiction        field_19 rappelEnvoye (bool sérialisé)
 *   field_9  numeroRole         field_20 createdBy
 *   field_10 salleAudience      field_21 createdAt
 *   field_11 agentId            field_22 updatedAt
 *
 * Limites connues de ce mode hybride (transitoire) :
 *   - L'attachement de pièces à une audience (`addEntityPiece('AUDIENCE', …)`)
 *     opère encore sur l'état seed et n'est donc pas persisté côté SharePoint
 *     (la liste « Pieces » n'est pas branchée). À éviter tant qu'on est hybride.
 *   - `deleteDossier` ne supprime pas en cascade les audiences SharePoint du
 *     dossier (seul l'état React est filtré).
 */
import type { Audience, IssueAudience, StatutAudience, TypeAudience } from '../../models';
import type { AudienceInput, BootstrapData } from '../source';
import { SeedDataSource } from './seed';
import { AudiencesService } from '../../generated/services/AudiencesService';
import type { AudiencesRead, AudiencesWrite } from '../../generated/models/AudiencesModel';

type SpAudienceWrite = Partial<Omit<AudiencesWrite, 'ID'>>;

/** "true"/"false"/"1"/"0"/"oui" → boolean. */
function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return /^(true|1|oui|yes)$/i.test(v.trim());
  return false;
}

/** Normalise une chaîne vide en `undefined` (champs optionnels du modèle). */
function blankToUndef(v: string | undefined): string | undefined {
  const s = (v ?? '').trim();
  return s === '' ? undefined : s;
}

/** Enregistrement SharePoint → modèle métier `Audience`. */
export function fromSpAudience(r: AudiencesRead): Audience {
  return {
    id: String(r.ID ?? ''),
    dossierId: r.field_1 ?? '',
    date: r.field_2 ?? '',
    heure: r.field_3 ?? '',
    dateTenueEffective: blankToUndef(r.field_4),
    statut: (blankToUndef(r.field_5) ?? 'PLANIFIEE') as StatutAudience,
    typeAudience: (blankToUndef(r.field_6) ?? 'MISE_EN_ETAT') as TypeAudience,
    juridictionId: blankToUndef(r.field_7),
    juridiction: r.field_8 ?? '',
    numeroRole: blankToUndef(r.field_9),
    salleAudience: blankToUndef(r.field_10),
    agentId: blankToUndef(r.field_11),
    agent: r.field_12 ?? '',
    avocatId: blankToUndef(r.field_13),
    objet: r.field_14 ?? r.Title ?? '',
    compteRendu: blankToUndef(r.field_15),
    issueAudience: blankToUndef(r.field_16) as IssueAudience | undefined,
    dateRenvoi: blankToUndef(r.field_17),
    piecesDeposees: blankToUndef(r.field_18),
    rappelEnvoye: parseBool(r.field_19),
    createdBy: blankToUndef(r.field_20),
    createdAt: blankToUndef(r.field_21) ?? r.Created,
    updatedAt: blankToUndef(r.field_22) ?? r.Modified,
  };
}

/**
 * Modèle métier → enregistrement SharePoint. N'écrit que les champs présents
 * (compatible `update(id, changedFields)` autant que `create`). `Title`
 * (colonne primaire de la liste) est aligné sur `objet`.
 */
export function toSpAudience(a: Partial<Audience>): SpAudienceWrite {
  const w: Record<string, unknown> = {};
  const set = (k: keyof Audience, field: string) => {
    if (a[k] !== undefined) w[field] = a[k];
  };
  if (a.objet !== undefined) { w.field_14 = a.objet; w.Title = a.objet; }
  set('dossierId', 'field_1');
  set('date', 'field_2');
  set('heure', 'field_3');
  set('dateTenueEffective', 'field_4');
  set('statut', 'field_5');
  set('typeAudience', 'field_6');
  set('juridictionId', 'field_7');
  set('juridiction', 'field_8');
  set('numeroRole', 'field_9');
  set('salleAudience', 'field_10');
  set('agentId', 'field_11');
  set('agent', 'field_12');
  set('avocatId', 'field_13');
  set('compteRendu', 'field_15');
  set('issueAudience', 'field_16');
  set('dateRenvoi', 'field_17');
  set('piecesDeposees', 'field_18');
  if (a.rappelEnvoye !== undefined) w.field_19 = String(a.rappelEnvoye);
  set('createdBy', 'field_20');
  set('createdAt', 'field_21');
  set('updatedAt', 'field_22');
  return w as SpAudienceWrite;
}

export class SharepointAudiencesDataSource extends SeedDataSource {
  /** Bootstrap seed, puis remplace les audiences par la liste SharePoint. */
  async bootstrap(): Promise<BootstrapData> {
    const base = await super.bootstrap();
    try {
      const res = await AudiencesService.getAll({ top: 5000, orderBy: ['field_2 desc'] });
      if (res.success && Array.isArray(res.data)) {
        base.audiences = res.data.map(fromSpAudience);
      } else {
        console.warn('[SharepointAudiences] getAll non réussi — fallback seed', res.error);
      }
    } catch (e) {
      // Hors player Power Apps (dev local pur), le runtime data n'est pas
      // disponible : on retombe silencieusement sur les audiences seed.
      console.warn('[SharepointAudiences] runtime SharePoint indisponible — fallback seed', e);
    }
    return base;
  }

  async createAudience(input: AudienceInput): Promise<Audience> {
    const res = await AudiencesService.create(toSpAudience(input) as Omit<AudiencesWrite, 'ID'>);
    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? 'Création audience SharePoint échouée');
    }
    return fromSpAudience(res.data);
  }

  async updateAudience(id: string, patch: Partial<Audience>): Promise<Audience> {
    const res = await AudiencesService.update(id, toSpAudience(patch));
    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? 'Mise à jour audience SharePoint échouée');
    }
    return fromSpAudience(res.data);
  }

  async deleteAudience(id: string): Promise<void> {
    await AudiencesService.delete(id);
  }
}
