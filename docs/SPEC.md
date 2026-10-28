# Manifold v0.1 implementation specification

Status: M0 complete with user-confirmed startup/build; M1 acquisition implemented with desktop verification pending. Architecture: [DESIGN.md](DESIGN.md).

## 1. Release outcome

A user on Windows can launch an installable Manifold build, select a local directory, navigate its file/folder structure in 3D, find and inspect files, and observe external changes without restarting the application.

The authoritative graph represents accessible source entries under the configured policy. The visible graph can be a collapsed or filtered subset. The UI must make that distinction clear.

## 2. Scope

Included:

- One open local directory per window; replacing it cancels the previous session.
- Files, directories, symbolic links, and containment edges.
- Orbit, pan, zoom, focus selection, and reset view.
- Expand/collapse, filename/path search, and file-type filtering.
- Read-only file metadata and bounded text preview.
- External change detection, reconciliation, refresh, progress, and error states.
- Windows packaging and documented development commands.

Deferred:

- Class/function nodes, imports, inheritance, call graphs, and language semantics.
- Editing, moving, deleting, or creating source files through the graph.
- Git history, remote repositories, collaboration, dynamic third-party plugins.
- macOS/Linux packaging, durable graph caches, and guaranteed rename identity.

## 3. Required behavior

### Opening and scanning

- Empty state offers Open Directory. Cancelling the native picker leaves the current project unchanged.
- A successful selection opens a new session with visible scan status and cancellation through opening another directory or closing the project.
- Show the selected root even when empty. Report missing or inaccessible roots with a recoverable error.
- Default excluded directory names: `.git`, `node_modules`, `dist`, `build`, `coverage`. Display the policy and allow project-level changes followed by reconciliation.
- Hidden entries otherwise remain eligible. `.gitignore` interpretation is deferred unless deliberately added with documented semantics.
- Show symbolic links as entries but do not traverse them in v1, including Windows junctions/reparse targets that act as directory links. Broken links get a diagnostic. This prevents cycles and traversal outside the root.
- Distinguish incomplete scan coverage from display filtering. No silent truncation.

### Graph navigation

- Directory and file nodes have distinguishable visual treatment, supported by labels/legend rather than color alone.
- Selection opens details; focusing moves the camera to the selected entity.
- Search covers indexed eligible entries, including collapsed descendants. Selecting a result reveals its ancestry and focuses it; if a filter hides it, explicitly clear or explain that filter.
- Collapse/expand does not change source records. Removed nodes disappear from the visible projection and selection updates safely.
- Controls and shortcuts are documented in the UI. Search, details, and core commands are keyboard accessible.

### Details and preview

- Display name, root-relative path, kind, size where applicable, and available modification metadata.
- Default preview read limit: 256 KiB; mark truncation. Do not read entire large files merely to truncate the displayed text.
- Support UTF-8 text initially, with an explicit message for binary or unsupported encoding. Syntax highlighting is optional for v0.1.
- Reload or invalidate a preview when its source changes. Reject responses from an obsolete session or selection request.
- Provide Reveal in Explorer. Opening a file in its default application is optional and must use validated desktop APIs rather than shell command interpolation.

### Synchronization and diagnostics

- Status distinguishes scanning, updating, current, incomplete, and failed. `Current` means no known pending work and successful latest reconciliation under the selected policy; it is not a transactional filesystem guarantee.
- Additions, removals, edits relevant to metadata/preview, and moves eventually update the projection after external activity stops.
- Apply graph changes atomically with monotonically increasing revisions per session.
- Watcher errors and missed-event simulations trigger reconciliation. Explicit Refresh remains available.
- Access errors identify affected resources and allow retry. Failures never masquerade as empty content.
- Closing/switching sessions cancels work, detaches watchers, and prevents late updates from changing the active view.

## 4. Provisional scale and performance targets

Benchmark on a recorded Windows development machine, local SSD, packaged production build. Record CPU, RAM, GPU, OS, fixture shape, and results before treating numbers as release claims.

| Scenario                      | Initial target                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Indexed directory fixture     | 10,000 eligible entries across mixed depths                                                         |
| Visible scene fixture         | 2,000 nodes with containment edges; labels limited adaptively                                       |
| Camera interaction            | Median frame time at or below 33 ms in the visible-scene fixture                                    |
| Initial indexing              | Complete 10,000-entry fixture within 10 seconds on the recorded machine                             |
| Single external create/delete | Visible within 2 seconds after the operation settles under normal watcher operation                 |
| Dropped notification recovery | Converge within one 30-second reconciliation interval plus scan time                                |
| Lifecycle                     | No continuing watchers/workers for closed sessions; no monotonic resource growth across 20 switches |

These are starting budgets to validate, not established capabilities. If a target fails, record evidence and either fix the bottleneck or explicitly revise the supported envelope. Large scenes must degrade through progressive disclosure and visible limits rather than an unresponsive UI.

## 5. Milestones and completion criteria

Complete milestones in order. A milestone is complete when its criteria pass and STATUS.md records the evidence.

### M0 â€” Repository and application skeleton

- [x] Set up TypeScript strict mode, React, Electron, Vite, packaging, and a committed lockfile.
- [x] Establish the source boundaries from DESIGN.md and enforce forbidden imports.
- [x] Add runtime-validated IPC contracts, isolated preload, sandboxed renderer, and a worker entry point.
- [x] Add format/lint/typecheck/test/build commands and document setup/run instructions.
- [x] Launch a desktop window with an empty state and verify production compilation.

Acceptance: a fresh checkout can install dependencies and run the desktop shell using documented commands. Boundary checks reject an intentionally forbidden import during local verification.

### M1 â€” Source model and directory acquisition

- [x] Define resource IDs, graph records, provenance, diagnostics, sessions, revisions, and ports.
- [x] Implement an in-memory test filesystem adapter and the Node filesystem adapter against the same contract cases.
- [x] Implement the directory analysis provider, ignore policy, and non-traversing symlink behavior.
- [x] Scan in a cancellable background worker and publish a valid immutable snapshot.
- [ ] Wire native directory selection and basic scan status.

Acceptance: empty, nested, excluded, inaccessible, Unicode, and symlink fixtures yield the expected nodes/edges/diagnostics. A directory scan produces no dangling edges. Opening a second root cannot publish results from the first.

### M2 â€” Useful 3D explorer

- [ ] Implement deterministic hierarchy layout independently of the renderer.
- [ ] Render source nodes/containment edges using React Three Fiber.
- [ ] Add camera navigation, selection, focus, reset, legend, and details.
- [ ] Add folder expansion/collapse and progressive visibility limits.

Acceptance: open Manifold's own directory and browse it; selection details match source paths; expanding/collapsing changes visibility without modifying the canonical graph. Layout output is repeatable for equivalent input and options.

### M3 â€” Reliable live synchronization

- [ ] Start watching before scanning; buffer events and reconcile before declaring current.
- [ ] Add event coalescing, scope generations, cancellation, and atomic provider-result replacement.
- [ ] Add periodic/focus/resume/error/manual reconciliation and bounded event queues.
- [ ] Reject obsolete session/input results and stale renderer messages.
- [ ] Expose current/updating/incomplete/error states and resource diagnostics.

Acceptance: the synchronization equivalence test below passes, including simulated event loss and out-of-order completion. Deleting a directory removes its descendants and incident edges in one published update.

### M4 â€” Find and inspect

- [ ] Add filename/path search across the indexed graph and reveal search results.
- [ ] Add file-type filtering with clear hidden-content state.
- [ ] Add bounded previews, binary/encoding messages, truncation, and preview invalidation.
- [ ] Add Reveal in Explorer and accessible commands/help.

Acceptance: searching a collapsed descendant reveals it; changing or deleting a selected file updates details/preview safely; preview limits are enforced at read time; filters do not alter the source graph.

### M5 â€” Performance and distributable build

- [ ] Run and record the benchmark envelope above; optimize measured bottlenecks.
- [ ] Verify repeated session switching and shutdown cleanup.
- [ ] Produce a Windows installer/package and test on a machine without the repository's development environment.
- [ ] Document install/run instructions, unsigned-build status if applicable, controls, limits, and known issues.
- [ ] Perform a final end-to-end walkthrough from directory selection through external change and refresh.

Acceptance: the packaged build satisfies the release outcome and all required behavior, or explicitly documented scope changes have been made before declaring v0.1 complete. Signing credentials and public distribution are separate release tasks; a locally testable unsigned artifact is sufficient for this milestone.

## 6. Verification strategy

Use tests for behavioral risks and architectural contracts, not implementation trivia.

### Synchronization equivalence test

1. Build a graph from a fixture directory through the normal service.
2. Apply additions, edits, deletions, moves, ignore-policy changes, and subtree replacements.
3. Deliver some watcher notifications late, duplicated, reordered, or not at all; allow reconciliation to run.
4. Finish pending work in deliberately varied order, then wait for quiescence.
5. Compare the incremental graph with an independent fresh scan of the same source and configuration.
6. Compare canonical nodes, edges, metadata, provenance inputs, and diagnostics; normalize session IDs, revision counters, ordering, and observation timestamps.

Use the same acquisition semantics for both paths, but do not reuse the incremental graph/cache as the fresh-scan input. Include both controllable in-memory cases and real temporary-directory integration cases.

Additional required cases:

- Files change during an in-flight read/analysis; old results cannot overwrite newer inputs.
- A project switches while a scan or preview is pending.
- A watcher fails or floods its queue; a rescan restores convergence.
- An inaccessible subtree recovers without restarting the application.
- Case-sensitive resource keys stay distinct in a fake adapter even when the initial OS differs.
- Renderer receives an old snapshot; it is ignored. If deltas are introduced, a revision gap requests a full snapshot.
- Invalid provider edges are rejected atomically.
- Ignore and symlink policy behave consistently in scans and incremental updates.

Keep core/provider tests runnable without Electron or a GPU. Use a small number of desktop smoke tests for IPC, selection, and packaged startup; record manual graphics checks where automation is unreliable.

## 7. Definition of done for each implementation session

- Work stays within the current milestone unless a dependency or defect justifies a documented change.
- Relevant checks pass, or exact failures and their consequences are recorded.
- Architectural decisions and public contracts reflect the implemented behavior.
- STATUS.md states completed work, verification, remaining issues, and a concrete next action.
- Do not mark unchecked release behavior complete based only on compilation or a screenshot.
