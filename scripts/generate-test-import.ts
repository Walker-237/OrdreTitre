/**
 * CLI — génère un fichier .xlsx prêt à importer, rempli de données réelles
 * (jamais inventées) piochées dans la source de données courante, pour
 * tester le flux d'import d'un module sans deviner de valeurs à la main.
 *
 * Usage :
 *   npm run generate-test-import -- <entite> [--count=20] [--out=chemin.xlsx] [--seed=42]
 *   npm run generate-test-import:audiences
 *
 * Entités disponibles : cf. `src/lib/imports/generators/registry.ts`.
 *
 * Limite connue : ne fonctionne que pour `DATA_SOURCE === 'seed'`
 * (cf. src/data/source.ts). Les backends `sharepoint`/`dataverse`
 * s'authentifient via le SDK Power Apps, qui exige le contexte du player —
 * indisponible dans un script Node autonome. Si `DATA_SOURCE` n'est pas
 * `'seed'`, le script le signale et s'arrête plutôt que d'échouer
 * silencieusement ou de retomber sur des données obsolètes.
 */
import * as path from 'node:path';
import { getDataSource, DATA_SOURCE } from '../src/data/source';
import { GENERATORS, contextFromBootstrap } from '../src/lib/imports/generators/registry';
import { writeGeneratedWorkbook, setSeed } from '../src/lib/imports/generators/core';

function parseArgs(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = new Map<string, string>();
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    flags.set(k, v ?? 'true');
  }
  return { entity: positional[0], flags };
}

async function main() {
  const { entity, flags } = parseArgs(process.argv.slice(2));

  if (!entity || !GENERATORS[entity]) {
    const keys = Object.keys(GENERATORS).join(', ');
    console.error(`Usage : npm run generate-test-import -- <entite> [--count=20] [--out=...] [--seed=42]`);
    console.error(`Entités disponibles : ${keys}`);
    process.exitCode = 1;
    return;
  }

  if (DATA_SOURCE !== 'seed') {
    console.error(
      `DATA_SOURCE = '${DATA_SOURCE}' — ce script ne peut lire que la source 'seed' en dehors du `
      + `navigateur (les backends SharePoint/Dataverse nécessitent l'authentification du player Power Apps, `
      + `absente dans un script Node autonome). Repassez DATA_SOURCE à 'seed' pour générer un fichier de `
      + `test hors-ligne, ou générez-le depuis une action équivalente exécutée dans l'app elle-même.`,
    );
    process.exitCode = 1;
    return;
  }

  const count = Number(flags.get('count') ?? '20');
  if (!Number.isFinite(count) || count <= 0) {
    console.error(`--count invalide : « ${flags.get('count')} »`);
    process.exitCode = 1;
    return;
  }
  if (flags.has('seed')) setSeed(Number(flags.get('seed')));

  const entry = GENERATORS[entity];
  const outputPath = flags.get('out')
    ?? path.join(process.cwd(), 'generated-test-imports', `${entity}-test-import.xlsx`);

  console.log(`[${entity}] bootstrap de la source de données (${DATA_SOURCE})…`);
  const data = await getDataSource().bootstrap();
  const ctx = contextFromBootstrap(data);

  if (entry.crossReferenceRisk) {
    console.log(`[${entity}] module à risque de référence croisée — les lignes générées piochent `
      + `parmi les entités réellement présentes (dossiers/agents/avocats/juridictions).`);
  }

  console.log(`[${entity}] génération de ${count} ligne(s)…`);
  const rows = entry.generateRows(data, count);

  console.log(`[${entity}] validation (parseRow) + aller-retour xlsx réel…`);
  const result = await writeGeneratedWorkbook({
    schema: entry.schema, rows, ctx, outputPath,
  });

  console.log(`[${entity}] OK — ${result.rowCount} ligne(s) valides écrites dans ${result.outputPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
