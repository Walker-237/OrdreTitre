# Données de référence — exports CSV

13 fichiers CSV (un par entité de l'app) prêts à importer dans **Excel**,
**SharePoint Lists**, ou **Dataverse** pour créer les listes/tables et y
charger les données initiales (= mêmes données que celles servies actuellement
par `src/data/seed.ts`).

**Régénérer après une modification du seed :**

```bash
node scripts/export-csv.mjs
```

---

## Fichiers générés

| Fichier | Entité | Lignes | Notes |
|---|---|---:|---|
| [`utilisateurs.csv`](utilisateurs.csv) | Comptes RBAC (5 rôles) | 4 | login unique |
| [`juridictions.csv`](juridictions.csv) | Référentiel juridictions | 4 | — |
| [`avocats.csv`](avocats.csv) | Avocats externes | 2 | `specialites` = liste séparée par `;` |
| [`agents.csv`](agents.csv) | Agents internes (DAJ) | 2 | — |
| [`dossiers.csv`](dossiers.csv) | Dossiers judiciaires | 5 | **Cœur de l'app** |
| [`parties.csv`](parties.csv) | Parties (1-N → Dossier) | 3 | lien `dossierId` |
| [`pieces.csv`](pieces.csv) | Pièces / documents (1-N → Dossier) | 2 | lien `dossierId` |
| [`audiences.csv`](audiences.csv) | Audiences planifiées / tenues | 4 | lien `dossierId` |
| [`deliberes.csv`](deliberes.csv) | Délibérés | 2 | `voiesRecours` = liste `;` |
| [`honoraires.csv`](honoraires.csv) | Factures avocats | 2 | liens `dossierId` + `avocatId` |
| [`jurisprudence.csv`](jurisprudence.csv) | Décisions de référence | 1 | `motsCles` = liste `;` |
| [`alertes.csv`](alertes.csv) | Alertes & rappels | 3 | `canaux` = liste `;` |
| [`audit.csv`](audit.csv) | Journal d'audit (lecture seule) | 2 | immuable |

## Conventions de format

- **Encodage** : UTF-8 avec BOM (Excel reconnaît directement les accents).
- **Séparateur** : virgule. *(En Excel français, si l'ouverture casse les colonnes,
  utiliser **Données → À partir d'un fichier texte/CSV** et choisir explicitement
  la virgule comme séparateur.)*
- **Booléens** : `TRUE` / `FALSE`.
- **Dates** : ISO `YYYY-MM-DD` (et `YYYY-MM-DDTHH:MM:SSZ` pour les timestamps).
- **Listes** (specialites, voiesRecours, canaux, motsCles) : valeurs séparées par
  **point-virgule** dans une seule cellule (ex. `EMAIL;NOTIFICATION_PUSH`).
- **Champs vides** : laissés vides (pas de `null` littéral).

## Schéma relationnel (clés étrangères)

```
utilisateurs ──────────────────────────────────┐
        │                                      │
        ▼ (utilisateurId)                      │
   avocats ── agents                           │
        │       │                              │
        │       │ (agentId)                    │ (utilisateurId)
        ▼       ▼                              │
    ┌── DOSSIERS ◄── parties (dossierId)       │
    │        │   ◄── pieces  (dossierId)       │
    │        │                                 │
    │        ├─◄── audiences (dossierId) ──────┤
    │        ├─◄── deliberes (dossierId)       │
    │        └─◄── honoraires (dossierId + avocatId)
    │
    └ jurisprudence (dossierId, delibereId, juridictionId — tous optionnels)

  alertes ──► dossier / audience / delibere / destinataire (tous optionnels)
  audit   ──► utilisateurId
  juridictions ◄── dossiers / audiences / jurisprudence (juridictionId)
```

## Valeurs des Choix (à recréer comme colonnes Choice/Choix dans SharePoint/Dataverse)

| Colonne | Valeurs autorisées |
|---|---|
| `nature` (Dossier) | `PENALE`, `SOCIALE`, `CIVILE`, `COMMERCIALE`, `ARBITRALE`, `AUTRE` |
| `typeAction` (Dossier) | `DEFENSEUR`, `DEMANDEUR` |
| `statut` (Dossier) | `OUVERT`, `EN_COURS`, `DELIBERE`, `CLOTURE`, `ARCHIVE` |
| `risque` (Dossier) | `FAIBLE`, `MOYEN`, `ELEVE` |
| `typeJuridiction` | `TRIBUNAL_PREMIERE_INSTANCE`, `COUR_APPEL`, `COUR_SUPREME`, `TRIBUNAL_COMMERCE`, `CONSEIL_PRUD_HOMMES`, `TRIBUNAL_ARBITRAL`, `AUTRE` |
| `niveau` (Juridiction) | `PREMIER_DEGRE`, `APPEL`, `CASSATION`, `INTERNATIONAL` |
| `typePartie` | `PERSONNE_PHYSIQUE`, `PERSONNE_MORALE` |
| `qualiteDansDossier` (Partie) | `PARTIE_ADVERSE`, `GARANT`, `CODEBITOR`, `TIERS`, `DEMANDEUR`, `AUTRE` |
| `statut` (Audience) | `PLANIFIEE`, `TENUE`, `REPORTEE`, `ANNULEE`, `EN_ATTENTE_DELIBERE` |
| `typeAudience` | `FOND`, `REFERE`, `MISE_EN_ETAT`, `PLAIDOIRIE`, `CONCILIATION`, `AUTRE` |
| `issueAudience` | `RENVOYE`, `MIS_EN_DELIBERE`, `CONCILIE`, `JUGE`, `EN_ATTENTE`, `AUTRE` |
| `statut` (Délibéré) | `EN_ATTENTE`, `RENDU`, `REPORTE`, `SANS_SUITE` |
| `resultat` (Délibéré) | `FAVORABLE`, `DEFAVORABLE`, `MIXTE`, `PARTIEL` |
| `voiesRecours` (Délibéré, multi) | `APPEL`, `POURVOI_CASSATION`, `TIERCE_OPPOSITION`, `OPPOSITION`, `AUCUNE` |
| `role` (Utilisateur) | `ADMIN`, `SUPERVISEUR`, `JURISTE`, `LECTEUR`, `AVOCAT_EXTERNE` |
| `sourceAuth` | `LDAP`, `AD`, `LOCAL` |
| `typeFrais` (Honoraire) | `HONORAIRES`, `FRAIS_DE_CONSIGNATION`, `DROITS_ENREGISTREMENT`, `FRAIS_EXPERTISE`, `FRAIS_HUISSIER`, `AUTRE` |
| `statutPaiement` | `EN_ATTENTE`, `VALIDE`, `PAYE`, `REJETE`, `PARTIEL` |
| `typeDocument` (Piece) | `ASSIGNATION`, `CONCLUSIONS`, `JUGEMENT`, `ORDONNANCE`, `REQUETE`, `ACTE_HUISSIER`, `CORRESPONDANCE`, `AUTRE` |
| `typeAlerte` | `RAPPEL_AUDIENCE`, `DELAI_RECOURS`, `DOSSIER_INCOMPLET`, `FRAIS_A_PAYER`, `DELIBERE_ATTENDU`, `CHARGE_AVOCAT`, `INACTIVITE_DOSSIER`, `AUTRE` |
| `severity` (Alerte) | `high`, `medium`, `low` |
| `canaux` (Alerte, multi) | `EMAIL`, `NOTIFICATION_PUSH`, `TEAMS`, `SMS` |
| `statut` (Alerte) | `EN_ATTENTE`, `ENVOYEE`, `LUE`, `IGNOREE`, `ERREUR` |
| `action` (Audit) | `CREATE`, `READ`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `EXPORT`, `PRINT` |

---

## Import dans Excel

1. **Ouvrir Excel** → onglet **Données** → **À partir d'un fichier texte/CSV**.
2. Sélectionner un `.csv` du dossier `csv/`.
3. Excel détecte UTF-8 + virgule grâce au BOM ; cliquer **Charger**.
4. Pour conserver les liens entre fichiers (clés étrangères), répéter pour
   chaque CSV dans des feuilles séparées ou dans un classeur **Power Query**.

## Import dans SharePoint Lists

1. [admin.powerplatform.com](https://make.powerapps.com) → ton site → **+ Nouveau** → **Liste**.
2. **À partir d'un CSV** → glisser le `.csv` correspondant.
3. Vérifier/ajuster les types de colonnes (Choix, Lookup, Nombre, Date…).
4. Répéter pour chaque CSV.
5. Convertir les colonnes `*Id` en **Recherche** (Lookup) vers la liste parente
   après import.

## Import dans Dataverse (alternative à la création manuelle des tables)

1. Maker portal → ta solution → **+ Nouveau** → **Table** → **Avec données externes**.
2. Choisir **Fichier Excel/CSV** → uploader le `.csv`.
3. Mapper chaque colonne au type Dataverse approprié (cf. valeurs des Choix
   ci-dessus + spécifications complètes dans [DATAVERSE.md](../DATAVERSE.md)).
4. Répéter pour chaque CSV ; remplacer les colonnes `*Id` par des **Lookup**
   après l'import du parent.

## Ordre d'import recommandé (respecte les FK)

1. `utilisateurs.csv`
2. `juridictions.csv`
3. `avocats.csv` (FK → utilisateurs)
4. `agents.csv` (FK → utilisateurs)
5. `dossiers.csv` (FK → juridictions, avocats, agents)
6. `parties.csv` + `pieces.csv` (FK → dossiers)
7. `audiences.csv` (FK → dossiers, juridictions, agents, avocats)
8. `deliberes.csv` (FK → dossiers, audiences)
9. `honoraires.csv` (FK → dossiers, avocats, utilisateurs)
10. `jurisprudence.csv` (FK optionnelles → dossiers, deliberes, juridictions)
11. `alertes.csv` (FK optionnelles → dossiers, audiences, deliberes, utilisateurs)
12. `audit.csv` (FK → utilisateurs)
