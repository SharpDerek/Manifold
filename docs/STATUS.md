# Manifold project status

Last updated: 2026-10-27.

## Current state

M0 scaffold is written: Electron host, React empty state, bundled sandbox preload, validated runtime-status IPC, worker entry, Forge/Vite packaging configuration, strict TypeScript configuration, lint/format/test commands, and dependency boundary checks. Dependencies are installed and package-lock.json exists. Security-related direct dependencies have been updated and typecheck, lint, and all four tests pass. Production bundles compile; final packaging is blocked by GitHub download EACCES. Desktop startup remains unverified.

Current milestone: **M0 â€” Repository and application skeleton**.

## Next session

1. Read README.md, DESIGN.md, and SPEC.md; inspect any repository instructions and existing changes.
2. Use Node 24 LTS and registry/Electron download access. Node is now 24.22.1 and npm is 11.21.1; npm registry connections still fail with EACCES in the restricted agent environment.
3. Review docs/DEPENDENCIES.md for remaining Forge transitive advisories (tar, extract-zip, tmp) and deprecated packages. Direct dependency upgrades and the real lockfile are present; do not blindly force major transitive overrides.
4. Run npm run check, npm run start, and npm run build. Verify worker Ready status, sandbox preload, CSP/HMR, window lifecycle, and packaged assets/worker paths. Fix issues before marking M0 complete.
5. Update milestone evidence, then begin M1 source model and directory acquisition only after M0 passes.

## Milestone tracker

| Milestone                 | Status      | Evidence                                                                                                                      |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| M0: Skeleton              | In progress | Typecheck, lint, 2 boundary tests and 2 IPC tests pass; production bundles compile; GUI and final packaging remain unverified |
| M1: Directory acquisition | Not started | â€”                                                                                                                           |
| M2: 3D explorer           | Not started | â€”                                                                                                                           |
| M3: Synchronization       | Not started | â€”                                                                                                                           |
| M4: Find and inspect      | Not started | â€”                                                                                                                           |
| M5: Distributable build   | Not started | â€”                                                                                                                           |

## Known limitations and deferred decisions

- Installed pins and lockfile are registry-resolved. Typecheck, ESLint, and four tests pass after upgrades. Remaining Forge transitive vulnerabilities are documented in docs/DEPENDENCIES.md; no clean audit is claimed. Desktop startup is unverified; packaging is download-blocked.
- Node 24.22.1 meets the supported runtime requirement, and the normal npm 11.21.1 launcher works. Registry fetches still fail with EACCES in the restricted agent environment, including with a writable project-local cache. npm 11 runs the installed toolchain; packageManager now records npm 11.21.1.
- No Git repository exists, so no files or lockfile have been committed.
- Performance budgets are provisional and unmeasured.
- Language analysis and additional OS adapters are intentionally deferred.
- No code signing or public distribution setup exists.
- No user decision blocks M0; routine implementation choices can proceed within the design.

## Session log

### 2026-10-27 — Installation warning review

- Reviewed the user's successful install log and generated lockfile. Distinguished deprecations from security advisories and npm install-script policy warnings; findings and upstream references are in docs/DEPENDENCIES.md.
- User ran the targeted upgrade commands from their network-enabled terminal. Verified installed exact pins: Forge 7.11.2, Electron 44.10.0, Vite 7.3.7, Vitest 4.1.12, ESLint 10.13.0, typescript-eslint 8.72.1, Zod 4.6.7. Preserved the generated lockfile.
- The post-upgrade successful install audit response lists only extract-zip, tar, and tmp. These remain in Forge's transitive build dependencies. extract-zip has no published patched version according to the reviewed advisory. Major transitive substitutions have not been forced without compatibility evidence.
- Reviewed esbuild's binary setup script and recorded approval for installed version 0.28.2; removed the obsolete 0.25.12 approval. Updated npm baseline and installation instructions.
- Passed after upgrade: npm run format; npm run check (typecheck, lint, 2 boundary tests, 2 IPC tests, formatting); npm install-scripts ls (no unreviewed packages). Applied the scaffold formatting baseline. Marked the M0 commands/documentation checkbox complete; desktop and full packaging criteria remain unchecked.
- npm run build compiled main, preload, worker, and renderer bundles, then failed downloading from GitHub with connect EACCES. Packaging and desktop interactive behavior remain unverified. Direct npm audit also remains blocked by registry access; findings use the actual successful user-install audit log.
- Next: resolve or explicitly track upstream Forge transitive security issues; verify packaged startup and worker Ready status from a terminal with download access. M0 remains incomplete.

### 2026-10-27 — Setup retry after Node/npm update

- Confirmed `node --version`: v24.22.1; `npm --version`: 11.21.1. The outdated Node runtime and npm launcher failures are resolved.
- Failed: `npm install --fetch-retries=0 --fetch-timeout=15000`, then `npm install --cache .cache/npm --fetch-retries=0 --fetch-timeout=10000`. Both returned EACCES fetching the Forge CLI from registry.npmjs.org. The local cache retry successfully wrote its log, ruling out the default cache write failure as the cause of the registry failure.
- Passed: `node scripts/check-boundaries.mjs`; `node --test tests/boundaries.test.mjs` (2 tests).
- Still blocked: dependency compatibility resolution, lockfile generation, formatting, typecheck/lint/Vitest, desktop startup, and production packaging. No milestone criteria were newly marked complete; no Git repository exists.
- Next action: run `npm install` in a terminal with registry and Electron download access, then run `npm run check`, `npm run start`, and `npm run build`. Review dependency compatibility and the generated lockfile before declaring M0 complete.

### 2026-10-27 â€” M0 scaffolding

- Added application shell, process separation, runtime contract validation, worker status, build configuration, and explicit dependency allowlists. Disabled Open Directory accurately reflects M1 scope.
- Added npm development/check/package commands and setup instructions. Deferred 3D/scanning dependencies until needed.
- Passed: `node scripts/check-boundaries.mjs`; `node --test tests/boundaries.test.mjs` (2 tests, including actual forbidden-import fixture).
- Failed: direct npm registry query and `npm install --package-lock-only --ignore-scripts --fetch-retries=0 --fetch-timeout=5000 --cache .cache/npm --registry https://registry.npmjs.org` returned EACCES for registry connections. No fabricated lockfile was created.
- Not run: dependency-based checks, formatting, GUI startup, worker integration, and packaging. M0 remains incomplete; next task is dependency installation on a supported runtime with network access.

### 2026-10-27 â€” Agent onboarding instructions

- Added root AGENTS.md with document reading order, architectural and consistency requirements, verification expectations, and session handoff steps.
- Linked the instructions from README.md. M0 remains the next implementation milestone.
- Verification: checked the instructions against the design/specification and confirmed referenced project documents exist. No application code changed.

### 2026-10-27 â€” Initial design and specification

- Established first-release scope, architecture, source consistency model, milestones, and acceptance criteria.
- Added a documented handoff process for subsequent sessions.
- Verification: reviewed document links and consistency; no application tests apply yet.

For future entries, record: changes, affected milestone checkboxes, commands/checks and outcomes, unresolved issues, and the next concrete task. Keep this file focused on current implementation state; record lasting architectural decisions in DESIGN.md.
