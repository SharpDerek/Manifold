# Manifold project status

Last updated: 2026-10-27.

## Current state

M0 is complete: the user confirmed desktop start and build, initialized Git, committed the baseline (`797e09c`), and opened branch `m1`. Forge 8.0.1 resolved the earlier transitive dependency issues; the last user-run npm audit log returned an empty advisory report.

M1 directory acquisition is implemented with automated source/worker coverage. The native picker and updated desktop UI still need manual verification. Current milestone: **M1 — Source model and directory acquisition**.

## Delivered behavior

- Framework-independent resource/graph records, metadata revisions, provider provenance, diagnostics, scan policy, session state, immutable graph publication, and graph integrity validation.
- Streaming Node filesystem adapter and controllable case-sensitive in-memory adapter behind the same port. Directory discovery is sequential (concurrency bound: one filesystem operation), cancellable between observations, and runs in the worker. Replacement requests retain only the latest queued scan, and wait for canceled OS work to finish before starting the replacement.
- Built-in directory provider creates deterministic nodes and containment edges. Root nodes are retained even for empty directories; missing/invalid roots fail visibly. Read failures and broken links produce incomplete coverage diagnostics.
- Default exact directory-name exclusions at every depth: .git, node_modules, dist, build, coverage. Hidden entries otherwise included; .gitignore is not interpreted. Project exclusions can be edited and applied with Refresh; settings are session-local.
- Symbolic links/junctions are displayed without enumerating targets, including loops and outside-root targets. Symbolic-link roots are rejected; canonical resource keys and path rules stay in the Node adapter.
- Runtime-validated project IPC exposes native Open Directory, state polling, policy refresh, and close. Renderer cannot submit paths or perform arbitrary filesystem operations. Sender validation, sandbox, context isolation, and disabled Node integration remain enabled.
- Session replacement/close cancels previous work; both worker and application reject obsolete results. Main-process state versions prevent stale poll/command responses from replacing newer renderer state. Canceled native picking preserves the current project.
- Basic UI displays scan progress, graph counts, diagnostics, and the first 200 indexed entries. The display cap does not cap indexing. Status says Scanned rather than Current: watching and reconciliation are M3 work.

## Verification

- Passed during implementation: strict TypeScript; boundary checks and lint; 2 boundary tests plus 42 Vitest tests, including both adapter contract suites and a real bundled-worker integration test. Final `npm run check` passed: typecheck, lint/boundaries, all 44 tests, and formatting. `git diff --check` also passed (Git emitted only line-ending conversion notices).
- Cases cover empty/nested/Unicode/hidden entries, default/custom exclusions, cancellation before/during enumeration, missing roots, injected EACCES enumeration failures, invalid provider endpoints, immutable publication, stable IDs, case-sensitive keys, source replacement by a junction, late session results, refresh/close/failure recovery, and strict IPC payload validation.
- Real Windows junction fixtures cover outside targets, loops, and dangling links. Permission failures use injected filesystem errors (portable, deterministic); a real Windows ACL-denied source directory has not been exercised.
- `npm run build`: main, sandbox preload, worker, and renderer production bundles compile. Final packaging fails with `fetch failed` in the restricted agent environment. The user's successful build confirmation predates M1.
- Added `npm run smoke:desktop` (requires production bundles). It exercises the real hidden desktop composition root, preload, sandbox settings, project IPC, scans, canceled picker behavior, policy refresh, close, and payload rejection using disposable fixtures and a mocked native dialog. Attempt blocked before app load by Electron's Windows install-directory sandbox ACL check; no sandbox or ACL settings were changed.
- Manual M1 checks still needed: real native picker open/cancel, visible progress and diagnostics, refresh/exclusions, closing/switching during a scan, and packaged startup/worker paths. HMR and visual interaction have not been verified in this session.

## Milestone tracker

| Milestone                 | Status                                    | Evidence                                                                            |
| ------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| M0: Skeleton              | Complete                                  | User-confirmed start/build; committed baseline; automated checks pass               |
| M1: Directory acquisition | Implemented; desktop verification pending | Adapter, graph, lifecycle, IPC and bundled-worker tests; production bundles compile |
| M2: 3D explorer           | Not started                               | Next implementation milestone after M1 desktop verification                         |
| M3: Synchronization       | Not started                               | No live watching/reconciliation yet                                                 |
| M4: Find and inspect      | Not started                               | No search, previews, or reveal action yet                                           |
| M5: Distributable build   | Not started                               | No recorded benchmarks or clean-machine release verification                        |

## Next concrete task

1. In a normal Windows terminal run `npm run build`, then `npm run smoke:desktop`, and `npm run start`.
2. Verify the real picker and UI cases above. Fix any desktop integration defects and finish M1's final acceptance checkbox.
3. Begin M2 with deterministic hierarchy layout and 3D projection, keeping source graph facts separate from presentation.

## Limitations and decisions

- Each acquisition publishes one full immutable graph at revision 1 of a fresh session. Refresh/policy changes start a new session; incremental revisions and live reconciliation are deferred to M3.
- Scans are observations of a changing source, not atomic disk snapshots. Adapter checks detect directory/link replacement before enumeration, but portable path-based filesystem APIs cannot eliminate every adversarial replacement race between checks and OS calls. No external change consistency claim is made yet.
- Metadata revisions are observation fingerprints, not content hashes. File content is not read during acquisition.
- No 3D renderer, semantic analysis, source previews, durable cache, measured performance figures, code signing, or public distribution in this milestone.
- Initial M0 scaffolding and dependency recovery history is preserved in Git. Architecture rationale lives in DESIGN.md; initial advisory details remain historical in DEPENDENCIES.md.

## M1 follow-up: development IPC sender rejection

- User reported Open Directory failing with Untrusted IPC sender. Inspected Forge 8's pluginExposeRenderer implementation: it injects an HTTP origin without a trailing slash, while Chromium's sender frame URL includes the slash. The raw string comparison rejected the legitimate renderer.
- Added full canonical URL comparison with URL.href. Retained owning-webContents and exact main-frame identity checks. Different host, port, scheme, document path, query, fragment, credentials, malformed URLs, and different production files remain rejected.
- Passed: npm run check (typecheck, lint/boundaries, 2 boundary tests plus 42 Vitest tests, formatting). Fourteen new URL regression cases include the actual Forge/Chromium slash mismatch and rejection cases.
- Desktop interaction remains subject to the previously recorded sandbox ACL limitation. Next: fully restart npm run start to load the updated Electron main process and verify Open Directory, then finish M1 desktop checks.
