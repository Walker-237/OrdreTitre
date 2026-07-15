# Branchement SharePoint Lists — Guide

Ce document décrit la procédure pour faire passer le Code App **« Ordre des Titres »**
des données seed locales vers les **listes SharePoint** déjà préparées via les
exports CSV ([csv/](csv/)).

L'app React est déjà prête : la couche `DataSource` ([src/data/source.ts](src/data/source.ts))
abstrait l'accès aux données. Aujourd'hui `SeedDataSource` ([src/data/sources/seed.ts](src/data/sources/seed.ts)).
Demain `SharepointDataSource` ([src/data/sources/sharepoint.ts](src/data/sources/sharepoint.ts))
une fois les listes provisionnées et `pac code add-data-source` exécuté.

---

## Pré-requis

| Item | Statut | Action si KO |
|---|---|---|
| Site SharePoint Online cible | ❓ | Créer un site d'équipe (ex. *AFB-AudiencesDeliberes*) sur `https://<tenant>.sharepoint.com/sites/<nom>` |
| Connecteur `shared_sharepointonline` autorisé dans l'env | ✅ par défaut | Vérifier dans le PPAC → Environments → DLP policies |
| Droits **Membre** sur le site | ❓ | Permet de créer les listes |
| Droits **Environment Maker** sur l'env Code App | ✅ | Permet `pac code add-data-source` |
| Blocage `InvalidAppBlobRequest` côté player résolu | ⚠️ encore ouvert | Cf. assignation du rôle Dataverse `System Administrator` |

---

## Étape 1 — Créer les 13 listes SharePoint depuis les CSV

Pour chaque fichier de [csv/](csv/), créer une liste portant **exactement le même nom**
(`Dossiers`, `Audiences`, etc., en respectant la casse — la sortie de `pac code add-data-source`
en dépend).

### Méthode rapide (1 clic par liste)

1. Ouvre le site SharePoint → **Contenu du site** → **Nouveau** → **Liste**.
2. Choisis **À partir d'un fichier CSV**.
3. Glisse le CSV du dossier [csv/](csv/) → SharePoint détecte automatiquement
   les colonnes et propose des types par défaut.
4. **Avant de valider**, vérifie / ajuste les types selon le tableau ci-dessous :
   - Texte simple → **Single line of text**
   - Texte long → **Multiple lines of text**
   - Nombres → **Number**
   - Devise/montants → **Currency** (devise XAF non native — laisser **Number**)
   - Dates → **Date and time** (ou Date only selon le champ)
   - Vrai/Faux → **Yes/No**
   - Colonnes ENUM → **Choice** (recopier les valeurs autorisées depuis [csv/README.md](csv/README.md))
   - Colonnes `…Id` → laisser **Single line of text** au départ ; après création
     de toutes les listes, les convertir en **Lookup** vers la liste parente.
5. Renomme la **colonne primaire** (`Title`) pour qu'elle corresponde au champ
   primaire métier (cf. tableau « Primary » ci-dessous).
6. Donne à la liste son nom exact (sans accents, casse stricte).

### Listes à créer + colonne primaire

| Liste SharePoint (Title interne) | Source | Primary | Notes |
|---|---|---|---|
| `Utilisateurs` | `utilisateurs.csv` | `Login` | — |
| `Juridictions` | `juridictions.csv` | `Libelle` | — |
| `Avocats` | `avocats.csv` | `Nom` | `Specialites` = colonne **Choice multi** |
| `Agents` | `agents.csv` | `Nom` | — |
| `Dossiers` | `dossiers.csv` | `Reference` | **Cœur de l'app**, beaucoup de Lookup |
| `Parties` | `parties.csv` | `NomRaisonSociale` | Lookup `DossierId` → `Dossiers` |
| `Pieces` | `pieces.csv` | `Libelle` | Lookup `DossierId` → `Dossiers` |
| `Audiences` | `audiences.csv` | `Objet` | Lookup `DossierId` → `Dossiers` |
| `Deliberes` | `deliberes.csv` | `Reference` (ou `DateDelibere`) | Lookup `DossierId`, `VoiesRecours` = Choice multi |
| `Honoraires` | `honoraires.csv` | `ReferenceFacture` | Lookups `DossierId` + `AvocatId` |
| `Jurisprudence` | `jurisprudence.csv` | `Reference` | `MotsCles` = Choice multi (ou Text) |
| `Alertes` | `alertes.csv` | `Title` | `Canaux` = Choice multi |
| `JournalAudit` | `audit.csv` | `IdEntiteCible` | Lecture seule à terme |

### Valeurs des Choix

Toutes les listes de valeurs autorisées (Nature, Statut, TypeAction, etc.) sont
documentées dans [csv/README.md § « Valeurs des Choix »](csv/README.md). Copier-coller
chaque liste de valeurs lors de la création de la colonne **Choice** dans SharePoint.

---

## Étape 2 — `pac code add-data-source` pour chaque liste

Une fois les 13 listes créées, génère les services typés côté Code App. Depuis
la racine du projet :

```powershell
$pac  = "$env:APPDATA\Code\User\globalStorage\microsoft-isvexptools.powerplatform-vscode\pac\tools\pac.exe"
$api  = "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
$site = "https://<tenant>.sharepoint.com/sites/<nom>"  # URL exacte de ton site

& $pac code add-data-source --apiId $api --dataset $site --table "Utilisateurs"
& $pac code add-data-source --apiId $api --dataset $site --table "Juridictions"
& $pac code add-data-source --apiId $api --dataset $site --table "Avocats"
& $pac code add-data-source --apiId $api --dataset $site --table "Agents"
& $pac code add-data-source --apiId $api --dataset $site --table "Dossiers"
& $pac code add-data-source --apiId $api --dataset $site --table "Parties"
& $pac code add-data-source --apiId $api --dataset $site --table "Pieces"
& $pac code add-data-source --apiId $api --dataset $site --table "Audiences"
& $pac code add-data-source --apiId $api --dataset $site --table "Deliberes"
& $pac code add-data-source --apiId $api --dataset $site --table "Honoraires"
& $pac code add-data-source --apiId $api --dataset $site --table "Jurisprudence"
& $pac code add-data-source --apiId $api --dataset $site --table "Alertes"
& $pac code add-data-source --apiId $api --dataset $site --table "JournalAudit"
```

Chaque appel crée :
- `src/Models/<ListName>.ts` — types TS de la liste (colonnes typées)
- `src/Services/<ListName>Service.ts` — méthodes : `getAll()`, `getById(id)`,
  `create(record)`, `update(id, record)`, `delete(id)`

Une **connection reference** est aussi enregistrée côté env. La première fois,
SharePoint te demandera de confirmer l'autorisation OAuth dans un navigateur.

---

## Étape 3 — Brancher `SharepointDataSource`

Ouvre [src/data/sources/sharepoint.ts](src/data/sources/sharepoint.ts) :

1. **Décommente** les `import { XxxService } from '../../Services/XxxService'`.
2. Dans `bootstrap()`, **décommente** le `Promise.all` (le squelette est déjà
   commenté avec la bonne structure, y compris l'hydratation `parties[]` /
   `pieces[]` dans chaque Dossier).
3. Écris les **mappers** `fromSp<Entity>(record) → <Entity>` qui :
   - traduisent les noms internes de colonnes SharePoint (camelCase, `_x00e9_`
     pour accents, `_x0020_` pour espaces) vers le modèle TS,
   - convertissent les **Lookup `*IdId`** (Id numérique SharePoint) en `string`
     du modèle,
   - laissent passer les **Choice mono-valeur** comme strings et splittent les
     **Choice multi-valeur** en tableaux (la SDK les renvoie déjà comme tableaux).
4. Idem pour `toSp<Entity>(model) → record` (création / update).
5. Implémente les méthodes `create/update/delete` :
   ```ts
   async createDossier(input) {
     const r = await DossiersService.create(this.toSpDossier(input));
     if (!r.success) throw new Error(r.error?.message);
     return this.fromSpDossier(r.data);
   }
   ```

---

## Étape 4 — Activer le flag

Dans [src/data/source.ts](src/data/source.ts), passe :
```ts
const DATA_SOURCE: DataSourceKind = 'sharepoint';
```

---

## Étape 5 — Build & push

```powershell
npm run build
pac code push
```

L'app rechargera ses données depuis SharePoint au premier mount (cf.
[src/data/store.tsx](src/data/store.tsx) — `useEffect` + `bootstrap()`).

---

## Conventions SharePoint à connaître

### Noms internes vs libellés d'affichage

SharePoint stocke deux noms par colonne :
- **Libellé d'affichage** : ce que tu vois dans la liste (ex. « Nature procédure »).
- **Nom interne** : ce que l'API renvoie (ex. `Nature_x0020_proc_x00e9_dure`).

Le nom interne est **figé à la création** — si tu renommes ensuite, seul le
libellé change. Le SDK Code Apps utilise les noms internes.

**Récupérer les noms internes :**
- Dans le maker SharePoint, clique sur l'entête de colonne → **Paramètres
  de la colonne** → l'URL contient `Field=…` (le nom interne).
- Ou via REST : `https://<tenant>.sharepoint.com/sites/<nom>/_api/web/lists/getbytitle('Dossiers')/fields?$select=Title,InternalName`

### Lookup vers une autre liste

Quand tu transformes une colonne `JuridictionId` en **Lookup** vers `Juridictions` :
- La colonne s'appelle toujours `JuridictionId` côté libellé.
- Mais l'API renvoie l'**Id du parent** dans `JuridictionIdId` (suffixe `Id`).
- Et le libellé du parent dans `JuridictionId` (objet `{ Title: '…' }`).

Adapter les mappers en conséquence (voir snippets dans `sharepoint.ts`).

### Limites SharePoint Online

- **5 000 items par vue** par défaut (limite « LVT »). Au-delà, paginer ou filtrer.
- Throttling à environ **600 requêtes / minute / utilisateur**.
- Colonnes Lookup limitées à **12 par liste** (à comptabiliser pour `Dossiers` qui
  en a beaucoup — peut nécessiter d'aplatir certains liens).

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `InvalidAppBlobRequest` côté player | Droits `ReadEnvironment` manquants | Cf. assignation rôle Dataverse System Administrator |
| `pac code add-data-source` demande une connexion | Première utilisation du connecteur SharePoint | Suivre le flow OAuth dans le navigateur ouvert |
| `403 Forbidden` au runtime | Utilisateur sans droits sur la liste SharePoint | Partager la liste avec le groupe AFB ou l'utilisateur connecté |
| Colonnes vides au mappage | Mauvais nom interne | Vérifier via `/_api/web/lists/getbytitle('X')/fields` |
| Lookup renvoie `null` | Champ Id du parent attendu en suffixe `Id` (ex. `DossierIdId`) | Adapter le mapper |
| Pagination tronquée à 100 items | Limite par défaut `getAll()` | Utiliser pagination explicite : `getAll({ top: 5000 })` |
