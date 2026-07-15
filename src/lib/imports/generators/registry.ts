/**
 * Registre des générateurs de fichiers de test d'import — un par schéma.
 * Ajouter une entité : écrire `./<entite>.ts` (fonction `generate*Rows`),
 * puis l'enregistrer ici. `scripts/generate-test-import.ts` ne connaît que
 * ce registre, jamais les schémas individuellement.
 */
import type { BootstrapData } from '../../../data/source';
import type { ImportContext, ImportSchema } from '../common';
import { AUDIENCES_IMPORT } from '../audiences';
import { DOSSIERS_IMPORT } from '../dossiers';
import { HONORAIRES_IMPORT } from '../honoraires';
import { DELIBERES_IMPORT } from '../deliberes';
import { AVOCATS_IMPORT } from '../avocats';
import { AGENTS_IMPORT } from '../agents';
import { JURIDICTIONS_IMPORT } from '../juridictions';
import { generateAudienceRows } from './audiences';
import { generateDossierRows } from './dossiers';
import { generateHonoraireRows } from './honoraires';
import { generateDelibereRows } from './deliberes';
import { generateAvocatRows } from './avocats';
import { generateAgentRows } from './agents';
import { generateJuridictionRows } from './juridictions';

export interface GeneratorEntry {
  key: string;
  /** true si les lignes générées référencent d'autres entités (dossiers, agents…) —
   *  ces modules nécessitent des données réelles non vides pour ces entités. */
  crossReferenceRisk: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ImportSchema<any>;
  generateRows: (data: BootstrapData, count: number) => Record<string, string>[];
}

export const GENERATORS: Record<string, GeneratorEntry> = {
  audiences: {
    key: 'audiences', crossReferenceRisk: true,
    schema: AUDIENCES_IMPORT, generateRows: generateAudienceRows,
  },
  dossiers: {
    key: 'dossiers', crossReferenceRisk: true,
    schema: DOSSIERS_IMPORT, generateRows: generateDossierRows,
  },
  honoraires: {
    key: 'honoraires', crossReferenceRisk: true,
    schema: HONORAIRES_IMPORT, generateRows: generateHonoraireRows,
  },
  deliberes: {
    key: 'deliberes', crossReferenceRisk: true,
    schema: DELIBERES_IMPORT, generateRows: generateDelibereRows,
  },
  avocats: {
    key: 'avocats', crossReferenceRisk: false,
    schema: AVOCATS_IMPORT, generateRows: generateAvocatRows,
  },
  agents: {
    key: 'agents', crossReferenceRisk: false,
    schema: AGENTS_IMPORT, generateRows: generateAgentRows,
  },
  juridictions: {
    key: 'juridictions', crossReferenceRisk: false,
    schema: JURIDICTIONS_IMPORT, generateRows: generateJuridictionRows,
  },
};

/** Construit l'`ImportContext` attendu par `schema.parseRow` à partir d'un bootstrap complet. */
export function contextFromBootstrap(data: BootstrapData): ImportContext {
  return {
    dossiers: data.dossiers,
    juridictions: data.juridictions,
    avocats: data.avocats,
    agents: data.agents,
  };
}
