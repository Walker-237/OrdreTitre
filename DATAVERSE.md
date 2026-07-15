# Branchement Dataverse — Guide complet

Ce document décrit la procédure pour faire passer le Code App **« Ordre des Titres »**
des données seed locales vers les tables **Dataverse** réelles.

L'app React est déjà préparée : une couche `DataSource` ([src/data/source.ts](src/data/source.ts))
abstrait l'accès aux données. Aujourd'hui elle utilise `SeedDataSource`
([src/data/sources/seed.ts](src/data/sources/seed.ts)). Demain elle utilisera
`DataverseDataSource` ([src/data/sources/dataverse.ts](src/data/sources/dataverse.ts))
une fois les tables provisionnées et `pac code add-data-source` exécuté.

---

## Pré-requis

| Item | Statut | Action si KO |
|---|---|---|
| Environnement Dataverse cible | ✅ `orgf9a7a51c` (`ca5c9c95-…`) | — |
| Code Apps activé sur l'env | ✅ | — |
| Droits **Environment Maker** | ✅ (push réussit) | — |
| Droits **System Customizer** / **System Administrator** | ❓ requis pour créer des tables ET pour que le **player** charge l'app (`InvalidAppBlobRequest` actuel) | PPAC → Environments → cet env → Settings → Users + permissions → Manage security roles |

> ⚠️ Tant que `InvalidAppBlobRequest` n'est pas résolu côté player, les appels Dataverse
> échoueront au runtime même si tout le reste est en place. Régler les droits **avant** de
> commencer.

---

## Étape 1 — Créer les 11 tables Dataverse

Le maker portal ([make.powerapps.com](https://make.powerapps.com) → bon env → **Tables** →
**Nouvelle table**) est la voie supportée. Pour chaque table :
- **Nom complet** : laisse Dataverse calculer le nom logique (`cr<XXX>_<name>`).
- **Colonne principale** : prends celle marquée *(primary)* ci-dessous.
- **Active la propriété d'objet** : Yes (default).
- **Activité de notes / collaboration** : non nécessaire.

Pour les **colonnes Choix** (ex. `nature` ∈ {PENALE, SOCIALE, …}), créer un type **Choice**
**locale** (pas global) avec exactement les valeurs listées.

Les **arrays** (`parties`, `pieces`, `voiesRecours`, `specialites`, `canaux`, `motsCles`)
sont stockés en **Multiline Text** sérialisé JSON (colonne `*_json`). Choix pragmatique :
les vraies relations Dataverse multipliraient le nombre de tables et de mappers par 3.

### 1.1 — Table `Dossier` *(la plus importante)*

| Colonne | Type | Détails |
|---|---|---|
| `reference` *(primary)* | Single line text | Max 50, requis, format `AFB-AAAA-NNNNN` |
| `intitule` | Single line text | Max 250, requis |
| `nature` | Choice | PENALE, SOCIALE, CIVILE, COMMERCIALE, ARBITRALE, AUTRE |
| `sousnature` | Single line text | Max 120 |
| `typeaction` | Choice | DEFENSEUR, DEMANDEUR |
| `juridiction` | Single line text | Dénormalisé pour affichage |
| `juridictionid` | Lookup → `Juridiction` | Optionnel |
| `ville` | Single line text | Max 80 |
| `montantenjeu` | Currency | Devise par défaut XAF |
| `devise` | Single line text | Max 3 (ISO 4217) |
| `statut` | Choice | OUVERT, EN_COURS, DELIBERE, CLOTURE, ARCHIVE |
| `agent` | Single line text | Dénormalisé |
| `agentid` | Lookup → `Agent` | Optionnel |
| `avocat` | Single line text | Dénormalisé |
| `avocatid` | Lookup → `Avocat` | Optionnel |
| `dateouverture` | Date Only | Requis |
| `datecloture` | Date Only | Optionnel |
| `datearchivage` | Date Only | Optionnel |
| `prochaineecheance` | Date Only | Requis |
| `progress` | Whole Number | Min 0, max 100 |
| `risque` | Choice | FAIBLE, MOYEN, ELEVE |
| `resumefaits` | Multiline text | Max 2000 |
| `observations` | Multiline text | Max 2000 |
| `parties_json` | Multiline text | JSON array `Partie[]` |
| `pieces_json` | Multiline text | JSON array `Piece[]` |
| `isdeleted` | Yes/No | Soft delete |

### 1.2 — Table `Audience`

| Colonne | Type | Détails |
|---|---|---|
| `objet` *(primary)* | Single line text | Max 200 |
| `dossierid` | Lookup → `Dossier` | Requis |
| `date` | Date Only | Requis |
| `heure` | Single line text | Format `HH:MM` |
| `datetenueeffective` | Date and Time | Optionnel |
| `statut` | Choice | PLANIFIEE, TENUE, REPORTEE, ANNULEE, EN_ATTENTE_DELIBERE |
| `typeaudience` | Choice | FOND, REFERE, MISE_EN_ETAT, PLAIDOIRIE, CONCILIATION, AUTRE |
| `juridiction` | Single line text | Dénormalisé |
| `numerorole` | Single line text | Max 60 |
| `salleaudience` | Single line text | Max 60 |
| `agent` | Single line text | |
| `compterendu` | Multiline text | |
| `issueaudience` | Choice | RENVOYE, MIS_EN_DELIBERE, CONCILIE, JUGE, EN_ATTENTE, AUTRE |
| `daterenvoi` | Date Only | |
| `piecesdeposees` | Single line text | |
| `rappelenvoye` | Yes/No | |

### 1.3 — Table `Delibere`

| Colonne | Type | Détails |
|---|---|---|
| `reference` *(primary)* | Single line text | Auto : `DEL-AAAA-NNNNN` |
| `dossierid` | Lookup → `Dossier` | Requis |
| `audienceorigineid` | Lookup → `Audience` | Optionnel |
| `datedelibere` | Date Only | Requis |
| `datedelibereeffectif` | Date Only | |
| `statut` | Choice | EN_ATTENTE, RENDU, REPORTE, SANS_SUITE |
| `resultat` | Choice | FAVORABLE, DEFAVORABLE, MIXTE, PARTIEL |
| `dispositif` | Multiline text | |
| `decision` | Multiline text | |
| `montantaccorde` | Currency | |
| `montantcondamne` | Currency | |
| `voiesrecours_json` | Multiline text | JSON array `VoieRecours[]` |
| `datelimiterecours` | Date Only | |
| `recoursexerce` | Yes/No | |
| `typerecoursexerce` | Choice | APPEL, POURVOI_CASSATION, TIERCE_OPPOSITION, OPPOSITION, AUCUNE |
| `dateexercicerecours` | Date Only | |
| `grosselevee` | Yes/No | |
| `dateleveegrosse` | Date Only | |
| `observations` | Multiline text | |

### 1.4 — Table `Avocat`

| Colonne | Type | Détails |
|---|---|---|
| `nom` *(primary)* | Single line text | |
| `prenom` | Single line text | |
| `cabinet` | Single line text | Requis |
| `numerobarreau` | Single line text | |
| `barreau` | Single line text | |
| `specialites_json` | Multiline text | JSON `string[]` |
| `telephone` | Single line text | |
| `telephonesecondaire` | Single line text | |
| `email` | Single line text | Format email |
| `adresse` | Multiline text | |
| `ville` | Single line text | |
| `seuildossiersmax` | Whole Number | Default 20 |
| `dossiersactifs` | Whole Number | Dénormalisé |
| `taux` | Whole Number | 0..100 |
| `honoraires` | Currency | Cumul |
| `isactive` | Yes/No | |
| `datedebutcollaboration` | Date Only | |
| `notes` | Multiline text | |

### 1.5 — Table `Agent`

| Colonne | Type | Détails |
|---|---|---|
| `nom` *(primary)* | Single line text | |
| `prenom` | Single line text | |
| `matricule` | Single line text | Max 20 |
| `poste` | Single line text | |
| `fonction` | Single line text | |
| `direction` | Single line text | Code département |
| `telephone` | Single line text | |
| `email` | Single line text | |
| `dossiers` | Whole Number | |
| `audiences` | Whole Number | |
| `taux` | Whole Number | 0..100 |
| `isactive` | Yes/No | |
| `datepriseFonction` | Date Only | |
| `notes` | Multiline text | |

### 1.6 — Table `Juridiction`

| Colonne | Type | Détails |
|---|---|---|
| `libelle` *(primary)* | Single line text | |
| `typejuridiction` | Choice | TRIBUNAL_PREMIERE_INSTANCE, COUR_APPEL, COUR_SUPREME, TRIBUNAL_COMMERCE, CONSEIL_PRUD_HOMMES, TRIBUNAL_ARBITRAL, AUTRE |
| `niveau` | Choice | PREMIER_DEGRE, APPEL, CASSATION, INTERNATIONAL |
| `ville` | Single line text | |
| `pays` | Single line text | Max 2 (ISO 3166) |
| `adresse` | Multiline text | |
| `telephone` | Single line text | |
| `emailgreffe` | Single line text | |
| `isactive` | Yes/No | |
| `notes` | Multiline text | |

### 1.7 — Table `Honoraire`

| Colonne | Type | Détails |
|---|---|---|
| `referencefacture` *(primary)* | Single line text | |
| `dossierid` | Lookup → `Dossier` | Requis |
| `avocatid` | Lookup → `Avocat` | Requis |
| `typefrais` | Choice | HONORAIRES, FRAIS_DE_CONSIGNATION, DROITS_ENREGISTREMENT, FRAIS_EXPERTISE, FRAIS_HUISSIER, AUTRE |
| `montantfacture` | Currency | Requis |
| `montantvalide` | Currency | |
| `montantpaye` | Currency | |
| `statutpaiement` | Choice | EN_ATTENTE, VALIDE, PAYE, REJETE, PARTIEL |
| `datefacture` | Date Only | Requis |
| `datevalidation` | Date Only | |
| `datepaiement` | Date Only | |
| `validateurid` | Lookup → `Utilisateur` | |
| `piecejointeurl` | Single line text | Max 500 |
| `observations` | Multiline text | |

### 1.8 — Table `Jurisprudence`

| Colonne | Type | Détails |
|---|---|---|
| `reference` *(primary)* | Single line text | Numéro décision |
| `delibereid` | Lookup → `Delibere` | Optionnel |
| `dossierid` | Lookup → `Dossier` | Optionnel |
| `juridictionid` | Lookup → `Juridiction` | Optionnel |
| `date` | Date Only | Requis |
| `juridiction` | Single line text | Dénormalisé |
| `matiere` | Choice | (mêmes valeurs que `nature` de Dossier) |
| `titre` | Single line text | Max 250 |
| `resume` | Multiline text | Requis |
| `dispositif` | Multiline text | |
| `motscles_json` | Multiline text | JSON `string[]` |
| `annotations` | Multiline text | |
| `fichierurl` | Single line text | Max 500 |
| `ispubliable` | Yes/No | |

### 1.9 — Table `Alerte`

| Colonne | Type | Détails |
|---|---|---|
| `title` *(primary)* | Single line text | |
| `typealerte` | Choice | RAPPEL_AUDIENCE, DELAI_RECOURS, DOSSIER_INCOMPLET, FRAIS_A_PAYER, DELIBERE_ATTENDU, CHARGE_AVOCAT, INACTIVITE_DOSSIER, AUTRE |
| `severity` | Choice | high, medium, low |
| `dossier` | Single line text | Référence dossier (affichage) |
| `dossierid` | Lookup → `Dossier` | |
| `audienceid` | Lookup → `Audience` | |
| `delibereid` | Lookup → `Delibere` | |
| `destinataireid` | Lookup → `Utilisateur` | |
| `message` | Multiline text | |
| `due` | Date Only | Échéance |
| `canaux_json` | Multiline text | JSON array |
| `statut` | Choice | EN_ATTENTE, ENVOYEE, LUE, IGNOREE, ERREUR |
| `dateenvoieffectif` | Date and Time | |
| `datelecture` | Date and Time | |
| `nbtentatives` | Whole Number | |

### 1.10 — Table `JournalAudit`

| Colonne | Type | Détails |
|---|---|---|
| `idauto` *(primary)* | AutoNumber | Format `AUD-{SEQNUM:000000}` |
| `utilisateurid` | Lookup → `Utilisateur` | |
| `utilisateurlogin` | Single line text | Dénormalisé |
| `action` | Choice | CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, PRINT |
| `entitecible` | Single line text | Ex. DOSSIER_JUDICIAIRE |
| `identitecible` | Single line text | |
| `valeuravant` | Multiline text | JSON tronqué |
| `valeurapres` | Multiline text | JSON tronqué |
| `ipadresse` | Single line text | Max 45 |
| `useragent` | Single line text | Max 300 |
| `timestamp` | Date and Time | Requis |

### 1.11 — Table `Utilisateur`

| Colonne | Type | Détails |
|---|---|---|
| `login` *(primary)* | Single line text | Unique |
| `nomaffichage` | Single line text | |
| `email` | Single line text | Format email |
| `role` | Choice | ADMIN, SUPERVISEUR, JURISTE, LECTEUR, AVOCAT_EXTERNE |
| `isactive` | Yes/No | |
| `derniereconnexion` | Date and Time | |
| `sourceauth` | Choice | LDAP, AD, LOCAL |

---

## Étape 1bis — (Ré)initialiser le Code App si nécessaire

Le projet est **déjà initialisé** (`power.config.json` à la racine, `appId = e603cc0c-…`).
Cette étape n'est utile que si tu pars d'un dossier vide ou recrées l'app de zéro.

⚠️ `pac code init` exige `--displayName` (sinon erreur *« A required argument
--displayName is missing »*). Le projet inclut un **wrapper** qui lit
`power.config.json` et compose la commande complète :

```powershell
.\scripts\pac-init.ps1
```

Équivalent direct (si tu préfères taper la commande à la main) :

```powershell
$pac = "$env:APPDATA\Code\User\globalStorage\microsoft-isvexptools.powerplatform-vscode\pac\tools\pac.exe"
& $pac code init `
    --displayName    "Ordre des Titres" `
    --buildPath      "dist" `
    --fileEntryPoint "index.html" `
    --appUrl         "http://localhost:3000" `
    --environment    "ca5c9c95-472e-e410-92b0-e34cdfd2e8fc" `
    --region         "prod"
```

> Pour repartir totalement de zéro : supprimer (ou renommer) `power.config.json`
> avant de lancer `pac code init` — sinon l'init échouera.

---

## Étape 2 — `pac code add-data-source` pour chaque table

Une fois les 11 tables créées dans Dataverse, génère les services typés. Depuis la racine
du projet :

```powershell
$pac = "$env:APPDATA\Code\User\globalStorage\microsoft-isvexptools.powerplatform-vscode\pac\tools\pac.exe"
$api = "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps"
& $pac code add-data-source --apiId $api --table cr<XXX>_dossier
& $pac code add-data-source --apiId $api --table cr<XXX>_audience
& $pac code add-data-source --apiId $api --table cr<XXX>_delibere
& $pac code add-data-source --apiId $api --table cr<XXX>_avocat
& $pac code add-data-source --apiId $api --table cr<XXX>_agent
& $pac code add-data-source --apiId $api --table cr<XXX>_juridiction
& $pac code add-data-source --apiId $api --table cr<XXX>_honoraire
& $pac code add-data-source --apiId $api --table cr<XXX>_jurisprudence
& $pac code add-data-source --apiId $api --table cr<XXX>_alerte
& $pac code add-data-source --apiId $api --table cr<XXX>_journalaudit
& $pac code add-data-source --apiId $api --table cr<XXX>_utilisateur
```

Remplace `cr<XXX>_` par le préfixe réel de ton publisher (visible dans le maker portal :
**Settings** → **Solutions** → ta solution → **Publishers**).

Chaque appel crée :
- `src/Models/<TableName>.ts` — types TS de l'entité
- `src/Services/<TableName>Service.ts` — méthodes typées : `getAll()`, `getById(id)`,
  `create(record)`, `update(id, record)`, `delete(id)`

---

## Étape 3 — Brancher `DataverseDataSource`

Ouvre [src/data/sources/dataverse.ts](src/data/sources/dataverse.ts) :

1. **Décommente** les `import { XxxService } from '../../Services/XxxService'`.
2. Dans `bootstrap()`, **décommente** le `Promise.all` et adapte les noms réels :
   ```ts
   const [dossiersDv, audiencesDv, ...] = await Promise.all([
     DossierService.getAll(),
     AudienceService.getAll(),
     // …
   ]);
   ```
3. Écris les **mappers** `fromDv<Entity>(record) → <Entity>` qui :
   - traduisent les noms de colonnes Dataverse (préfixées `cr<XXX>_…`) vers les noms du
     modèle TS (camelCase),
   - **parsent les colonnes `*_json`** avec `JSON.parse(record.cr_parties_json ?? '[]')`,
   - laissent passer les choix tels quels (Dataverse renvoie la string de la valeur).
4. Pareil pour les mappers inverses `toDv<Entity>(model) → record` utilisés dans
   `createDossier` / `toggleUtilisateurActive`.

---

## Étape 4 — Activer le flag

Dans [src/data/source.ts](src/data/source.ts), passe :
```ts
const USE_DATAVERSE = true;
```

---

## Étape 5 — Build & push

```powershell
npm run build
pac code push
```

L'app rechargera ses données depuis Dataverse au premier mount (cf.
[src/data/store.tsx](src/data/store.tsx) — `useEffect` + `bootstrap()`).

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `InvalidAppBlobRequest` côté player | Manque de droits `ReadEnvironment` | Voir Pré-requis ci-dessus |
| `pac code add-data-source` 403 | Manque de droits `prvCreateApiConnection` ou `prvCreateConnectionReference` | Demander rôle System Customizer |
| `bootstrap()` lève « not branché » | `USE_DATAVERSE = true` mais `DataverseDataSource` pas rempli | Étape 3 |
| Pages vides après push | Tables Dataverse vides | Seed des données via maker portal (Table → Edit data) |
| Champs Choix `null` à l'affichage | Mapper Dataverse retourne l'objet OptionSet au lieu de la string | Utiliser `.Value` ou `.name` selon le service généré |
