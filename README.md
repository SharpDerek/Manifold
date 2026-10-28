# Manifold

Manifold is a desktop application for exploring directories and codebases as interactive three-dimensional graphs. Nodes represent source entities; edges represent relationships between them.

The first release targets Windows and displays directories and files. The architecture must allow additional operating systems, language analyzers, layouts, and renderers without rewriting the core model.

## Project documents

- [Agent instructions](AGENTS.md): working rules and session handoff requirements.
- [Design](docs/DESIGN.md): architectural decisions, boundaries, data model, and synchronization.
- [Implementation specification](docs/SPEC.md): first-release behavior, milestones, and acceptance criteria.
- [Project status](docs/STATUS.md): current state, next work, and session handoffs.

Before implementing a milestone, read the linked project documents. Update the status document when ending a work session. Record changes to architectural decisions in the design document, including the reason for the change.

## Development

Use Node.js 24 LTS (or Node 22.12+) and npm 11.21.1. Dependencies and a committed lockfile are present. M0 startup/build is verified; M1 directory acquisition is implemented with desktop verification pending. See [dependency findings](docs/DEPENDENCIES.md) and STATUS.md for verification limits.

```powershell
npm install
npm run start
```

Use `npm ci` for reproducible installs from `package-lock.json`; use `npm install` when deliberately updating dependencies and review the manifest and lockfile together. Electron downloads a platform runtime during installation, so npm registry and Electron download access are required.

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `npm run start`     | Launch development desktop with renderer hot reload |
| `npm run typecheck` | Check strict TypeScript contracts                   |
| `npm run lint`      | Enforce source boundaries and lint                  |
| `npm test`          | Boundary tests and IPC schema tests                 |
| `npm run format`    | Format source and documents                         |
| `npm run check`     | Types, lint, tests, and formatting check            |
| `npm run build`     | Compile and package application into `out/`         |
| `npm run make`      | Create a Windows ZIP distribution in `out/make/`    |

Use Open Directory to scan a local directory. The UI shows scan progress, indexed entry/edge counts, coverage diagnostics, and a limited entry table. Close Project cancels work; opening another directory replaces the session only after a successful picker selection. Refresh rescans with the editable excluded directory names. Symbolic links/junctions are displayed without traversing targets. Scans do not read file contents or modify source files. External changes require Refresh; live updates and 3D navigation are later milestones.

After production bundle compilation, `npm run smoke:desktop` checks the real desktop preload/IPC and worker using a hidden window, disposable fixtures, and a mocked native dialog. It does not verify the real native picker or visual interaction. It retains the renderer sandbox; Windows sandbox ACL restrictions can prevent it from starting in the agent environment.

Without installed dependencies, architectural checks can still run:

```powershell
node scripts/check-boundaries.mjs
node --test tests/boundaries.test.mjs
```

In the restricted initial workspace, the normal npm shim encountered a user-directory permission error. Direct invocation worked around that launcher issue, but registry access was independently denied:

```powershell
node --preserve-symlinks-main 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' --version
```

This workaround does not provide a supported Node version or bypass network restrictions. Use the supported runtime and normal npm commands in an unrestricted development environment.
