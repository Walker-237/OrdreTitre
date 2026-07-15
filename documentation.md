# OrdreTitres — Project Documentation

## Project Overview

OrdreTitres is a TypeScript + React single-page application (SPA) built with Vite. It provides a document and case management UI backed by CSV data sources and generated TypeScript models and services. The app includes role-based access control (RBAC), import/export helpers, and connectors for Dataverse and SharePoint sources.

## Tech Stack

- Frontend: React + TypeScript
- Bundler: Vite
- Codegen: generated TypeScript models/services (under `src/generated`)
- Data sources: CSV files in the `csv/` folder used for seed/import
- Scripts: Node/Electron/PowerShell helper scripts in `scripts/`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

4. Preview production build (if available):

```bash
npm run preview
```

Note: Commands are defined in `package.json`.

## Project Structure (high level)

- `src/` — Application source code
  - `main.tsx`, `App.tsx` — App entry and root UI
  - `pages/` — Page-level React components (Dashboard, Dossiers, Utilisateurs, etc.)
  - `components/` — Reusable UI components (dialogs, pagination, searchable selects)
  - `layouts/` — Shell and layout components (`Shell.tsx`)
  - `lib/` — Helpers and utilities (`export.ts`, `import.ts`, `notify.ts`, `reports.ts`, `upload.ts`)
  - `data/` — Runtime data, store and seed helpers
  - `generated/` — Code-generated models and services (Models and Services per entity)
  - `assets/` — Static assets used by the app
  - `rbac.tsx` — Role-based access control helpers and hooks

- `csv/` — CSV seed / input files (agents.csv, dossiers.csv, utilisateurs.csv, ...)
- `public/` — Static public assets
- `scripts/` — Helper scripts (PowerShell, small Node utilities)
- `package.json`, `vite.config.ts`, `tsconfig*.json` — Build and TypeScript config

## Data Sources & Codegen

- The `csv/` directory contains sample and seed CSV files used to populate the app for development or import. See `csv/README.md` for CSV formats.
- The `src/generated` folder contains TypeScript models and service wrappers generated from your backend or model definitions. These files provide typed accessors for entities such as `Dossiers`, `Utilisateurs`, `Pieces`, etc.
- Services in `generated/services` are used by UI pages to fetch or mutate entity data; they may be wired to real APIs or local seed data depending on runtime configuration.

## Authentication & RBAC

- `src/auth.tsx` and `src/rbac.tsx` contain authentication and authorization logic. RBAC determines which pages and UI actions are available to the current user role.
- Roles and permissions are surfaced in the UI (e.g., `RolesPermissions.tsx`) and enforced by the `rbac` helpers.

## Important Files

- `package.json` — NPM scripts, dependencies
- `vite.config.ts` — Vite configuration
- `tsconfig.json` and `tsconfig.app.json` — TypeScript configuration
- `src/main.tsx` — App bootstrap
- `src/generated` — Generated models and services
- `csv/README.md` — CSV file format (if present)

## Development Notes

- Keep generated code in `src/generated` up to date with the codegen tool or API spec you use.
- UI components are small and focused; prefer composing existing components in `components/` before adding new ones.
- Use `lib/import.ts` and `lib/export.ts` for data persistence or interchange.

## Testing & Linting

- ESLint configuration is present (`eslint.config.js`). Run linting with your usual npm scripts (if defined).
- There are no explicit unit tests in the repository root; add tests under a `tests/` or `__tests__` folder if you want to introduce automated tests.

## Deployment

- Build with `npm run build` to produce production assets. Serve the resulting `dist/` with a static host (Netlify, Vercel, or a simple static server).
- If the app talks to remote APIs (Dataverse / SharePoint connectors), ensure proper environment variables or configuration are set in the deployment environment.

## Contributing

- Follow the existing code style and TypeScript typing patterns used across `src/`.
- Update or add entries to `csv/` when introducing new entities or changing model shapes.
- Regenerate `src/generated` when the API or model definitions change.

## Troubleshooting & Tips

- If imports from `src/generated` fail, run the codegen step or check the generator configuration.
- For RBAC issues, verify the current user's role and inspect `src/rbac.tsx` logic.
- Use the `scripts/` utilities for CSV exports/imports and initial environment setup.

## Next Steps / Improvements

- Add automated tests and a CI pipeline.
- Document CSV schemas more formally and add validation on import.
- Add a README section describing the code generation process and toolchain.

---

If you want, I can expand any section into more detail (CSV schema, codegen instructions, deploy steps), or convert this into `README.md` replacing the current README. Let me know which sections you want expanded.