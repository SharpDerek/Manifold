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

Use Node.js 24 LTS (or Node 22.12+) and npm 11.21.1. Dependencies and a committed lockfile are present. M0 and M1 are verified; M2 adds the 3D explorer with graphics verification pending. See [dependency findings](docs/DEPENDENCIES.md) and STATUS.md for verification limits.

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

Use Open Directory to scan a local directory. The UI shows scan progress, indexed entry/edge counts, coverage diagnostics, and a 3D graph with a keyboard-accessible directory list and selection details. Close Project cancels work; opening another directory replaces the session only after a successful picker selection. Refresh rescans with the editable excluded directory names. Symbolic links/junctions are displayed without traversing targets. Scans do not read file contents or modify source files. External changes require Refresh; live updates are a later milestone.

The graph initially shows the root and its immediate children. Select a node or list entry to inspect its root-relative path, kind, size, and modification time. Expand or collapse directories using the details panel or list. The graph uses boxes for folders, spheres for files, and diamonds for symbolic links.

- Left-drag or one-finger touch: orbit. Right-drag: pan. Wheel: zoom. Two-finger touch: pan/zoom.
- Click: select. Double-click or Focus selection: focus the camera. Reset view fits the visible graph.
- With the canvas focused, arrows pan, F focuses the selection, and R resets the view. Buttons and the paginated directory list provide keyboard alternatives for selection/expansion/focus/reset.
- The visible-node limit is 500 by default, adjustable to 1,000 or 2,000. Labels are limited to 40 including the selected entry. Hidden counts describe presentation only; indexing is unchanged. Collapse other branches or increase the cap when it is reached. The visible list shows 100 entries per page.
- WebGL2 is required for 3D. If rendering fails, the directory list and selection details remain usable. Graphics behavior and performance require verification on the target machine.

After production bundle compilation, `npm run smoke:desktop` checks desktop preload/IPC, scanning, the layout worker, WebGL initialization, expansion/collapse, selection/details, focus/reset commands, and source immutability using a hidden window, disposable fixtures, and a mocked native dialog. It does not verify the real native picker or visual interaction. It retains the renderer sandbox; Windows sandbox ACL restrictions can prevent it from starting in the agent environment.

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
