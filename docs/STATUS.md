# Manifold project status

Last updated: 2026-10-27.

## Current state

M0 and M1 are complete. The user confirmed the M1 desktop behavior after the canonical-URL IPC sender fix, committed the work, and opened clean branch `m2`.

**M2 — Useful 3D explorer** is implemented; desktop graphics acceptance is pending. No M3 live synchronization work has been started.

## Delivered in M2

- Deterministic iterative hierarchy layout, independent of Three.js/React/platform APIs, enforced by import checks. Stable coordinates across collapse/expand/display caps, including equivalent snapshots with reordered arrays.
- Cancellable browser-worker projection/layout with obsolete-result rejection. Canonical graph records remain untouched. Initial visibility is root and immediate children; folders expand progressively.
- Three.js 0.186.1 + React Three Fiber 9.8.2 and @types/three 0.186.0 installed by the user with exact pins and generated lockfile.
- On-demand 3D rendering: instanced box/sphere/diamond nodes, batched containment edges, shape legend, selection highlight, and up to 40 local text labels including the selection.
- Orbit/pan/zoom, focus selection, reset-to-visible-graph, mouse/touch controls, canvas keyboard shortcuts, and documented UI help.
- Selection details show root-relative path, kind, file size, modification time, and immediate-child count. Selection clears when hidden/removed from the visible projection. A paginated directory list supplies keyboard-accessible selection/expansion/focus alternatives.
- Default 500 visible nodes, adjustable to 1,000/2,000; explicit indexed/visible/hidden counts and truncation messaging. Display caps do not truncate indexing.
- Extended desktop smoke script to exercise actual WebGL initialization, browser layout worker, expansion/collapse, selection/details, focus/reset commands, and preservation of source graph facts.

## Verification and evidence

- Passed: strict TypeScript, lint/import boundaries, 2 Node boundary tests plus 57 Vitest tests (59 total), and formatting via `npm run check`. Final aggregate outcome is confirmed in the session response.
- Ten pure-layout tests cover initial visibility, progressive expansion, collapse without source mutation, stable coordinates, reordered-equivalent inputs, visible edge integrity, honest caps, empty root, unknown expansion IDs, links, and deep/wide 12,001-node fixtures. These fixtures establish structural robustness, not a performance benchmark.
- A real bundled browser-layout worker test runs off-thread through a Node self/onmessage bridge, with valid projection and invalid-request cases. It needs no Electron or GPU. Existing scan-worker, filesystem, lifecycle, IPC, and URL-sender regressions remain passing.
- `npm run build`: production main, preload, scan worker, renderer, lazy 3D module, and browser layout worker compile. Final packaging still fails at an external fetch in this agent environment.
- Desktop smoke was attempted with the real Electron runtime. Windows aborts before app load because the sandbox token cannot read the Electron install directory under this environment's ACL. Renderer sandbox/security settings and ACLs were preserved. Graphics tests did not execute; no visual correctness or frame-time claim is made.
- User-confirmed M1 verification is separate from the unverified M2 graphics changes. No real manual browse of Manifold's own directory, GPU interaction, HMR, WebGL fallback, or packaged M2 startup has been verified here.

## Next concrete task

1. From the normal Windows terminal run `npm run build`, `npm run smoke:desktop`, and `npm run start`.
2. Open Manifold's own directory. Verify orbit/pan/zoom, node/list selection and matching details, expansion/collapse, focus/reset, keyboard controls, and explicit hidden-content counts. Test an empty directory and a directory large enough to hit the display cap.
3. Fix any graphics/integration defects and complete M2's rendering/navigation acceptance checkboxes. Then begin M3 watching plus reconciliation; preserve the on-demand Scanned status until that consistency implementation is verified.

## Milestones

| Milestone                    | Status                                     | Evidence                                                        |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| M0: Skeleton                 | Complete                                   | User-confirmed startup/build, committed baseline, checks        |
| M1: Directory acquisition    | Complete                                   | Automated contracts/worker tests plus user desktop confirmation |
| M2: 3D explorer              | Implemented; graphics verification pending | Layout/projection and worker tests; production compilation      |
| M3: Live synchronization     | Not started                                | External changes still require Refresh                          |
| M4: Find and inspect         | Not started                                | No search/filter/preview/reveal action yet                      |
| M5: Performance/distribution | Not started                                | No recorded benchmarks or clean-machine release verification    |

## Known limitations

- No live watching, source reconciliation, content previews, or search. Successful acquisition still means Scanned, not Current.
- Canonical coordinates preserve gaps for collapsed branches. Very broad source levels may exceed even the 2,000-node cap; hidden entries are reported but cannot all be revealed simultaneously. Full search/reveal is deferred to M4.
- A fresh scan creates a new session and resets presentation state. No durable layout/camera state is stored.
- The 3D renderer requires WebGL2. List/details remain available on rendering failure, but that fallback still needs desktop verification. Label overlap and scene performance are unmeasured; M5 budgets remain provisional.
- M1 symlink, metadata-fingerprint, and source-observation limitations remain: no deliberate target traversal, no content hashing, and no atomic filesystem snapshot guarantee.
- No signing/public distribution setup. No dependencies were force-overridden or warning-suppressed during M2.

## M2 follow-up: invalid hook call on directory opening/selection

- User reported the scene fallback and supplied React's Invalid hook call error. npm ls confirms one React 19.2.0 installation, deduped through React DOM and Fiber, with compatible declared peers.
- Added Vite renderer resolve.dedupe for React, React DOM, and Three.js, plus explicit dependency optimization of the lazy 3D renderer and its React entry points. A fresh optimized-bundle test verifies app React, React DOM client, and Fiber all import the same shared React module before scene loading. A stale/duplicated development module is the likely cause; the exact failing browser stack has not been captured.
- Added actual scene mount/selection tests using Fiber's real reconciler with a graphics-driver stub, plus React DOM server coverage of the Canvas bridge. These pass without a GPU, including StrictMode and empty node-kind groups. They do not establish real browser/WebGL behavior. Node's test-only Fiber CommonJS import emits a Three.js CJS deprecation warning; production uses the ESM renderer.
- Scene fallback now exposes the underlying error in expandable details instead of hiding it behind a generic message.
- Next: stop the existing development process and close its Electron window, then run npm run start again to load the new optimizer configuration and discard old React instances. Verify directory opening and graph selection. M2 graphics acceptance remains pending.

## M2 follow-up: null useMemo after initial bundler hardening

- User still reports Cannot read properties of null (reading useMemo). Supplied defaultOnCaughtError frame is React DOM's error handler, not the originating call site. Exact browser cause is still unconfirmed; do not describe the issue as fixed based on Node tests alone.
- Expanded the scene fallback to show error.stack (not just error.message) and added Reload view so the existing main-process project can be loaded into a fresh renderer.
- Isolated the renderer optimizer cache in .cache/vite-renderer and canonicalized symlink resolution, overriding Forge's preserveSymlinks default. Retained explicit React deduplication and eager dependency optimization. New config requires a complete dev-process restart.
- Passed npm run check: all 58 tests, typecheck, import boundaries/lint, formatting. No new GPU verification claim. Started then stopped a separate reproduction Vite server; its temporary fixture is ignored under .cache.
- Automatic execution policy rejected launching a separate headless Chrome reproduction because sandbox approvals are disabled. No browser execution or graphics verification occurred through that route.
- Next: restart npm run start, open the directory, and if it fails copy the full Rendering error details block now containing the original stack. Continue from the first non-React-error-handler frame rather than making another unverified dependency change.

## M2 follow-up: mixed development bundle generations identified

- User supplied the originating stack: CanvasImpl uses Fiber/React chunks at v=88960f80 while React DOM client is still running v=295453b1. Failure is at CanvasImpl's first React.useMemo, before application scene hooks. This identifies mixed runtime generations rather than a broken scene selection hook.
- Earlier prebundle identity tests checked only one completed optimization result; they did not cover later worker dependency discovery. The browser layout worker imports Zod after directory opening, and Zod/react-dom were not explicit optimizer entries.
- Disabled late dependency discovery and explicitly prebundle all direct browser runtime entries, including Zod and react-dom. Load GraphCanvas eagerly with the application module graph; WebGL still mounts only after a source projection exists. This trades initial JS loading cost for stable renderer identity; no performance claim is made.
- Added a live Vite middleware integration test that transforms application startup, scene, browser worker, and worker contracts in sequence. It verifies equal React DOM/Fiber/Zod dependency generation URLs, unchanged optimizer metadata, and no late-discovered dependencies. Middleware test does not launch a browser or require a GPU.
- Full desktop confirmation remains pending. Stop the running development process and close its Electron window, then restart npm run start. If the fallback still occurs, its details retain the original stack.
