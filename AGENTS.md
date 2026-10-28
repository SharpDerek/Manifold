# Working on Manifold

## Purpose and starting point

Manifold is a desktop application for exploring directories and codebases as interactive 3D graphs. Nodes represent source entities; edges represent their relationships. The first release targets Windows and local files/directories. Additional operating systems and language analysis must fit behind explicit boundaries.

Before changing code, read:

1. [README.md](README.md) for orientation and development commands as they become available.
2. [docs/DESIGN.md](docs/DESIGN.md) for architecture and decision rationale.
3. [docs/SPEC.md](docs/SPEC.md) for scope, milestones, and acceptance criteria.
4. [docs/STATUS.md](docs/STATUS.md) for current progress, known issues, and the next task.

Use these files as durable project context; do not assume access to earlier conversations. Inspect the actual workspace and existing changes before proceeding. Preserve unrelated work. If Git is initialized, inspect its status and relevant diff; do not assume this repository already has Git or application tooling configured.

## How to proceed

- Follow the user's current instructions. Otherwise, continue from the first incomplete milestone and the next task recorded in STATUS.md.
- Complete a coherent, verifiable piece of that milestone. Do not expand into deferred features merely because the architecture anticipates them.
- Make routine implementation decisions autonomously within the documented scope. Ask when unresolved requirements materially change behavior, scope, or architecture; explain the decision needed.
- Check current official documentation when selecting dependencies or relying on version-specific APIs. Record compatible versions through the package manifest and lockfile.
- Keep documentation aligned with implementation. If evidence requires an architectural change, record its rationale in DESIGN.md and update affected specification criteria. Do not silently weaken acceptance criteria to make checks pass.

## Architectural requirements

- Core graph records and domain logic are plain data and framework-independent. They must not import Node, Electron, React, Three.js, or concrete adapters.
- Application services depend on platform and analysis interfaces. OS APIs, path rules, filesystem watching, and desktop actions belong in adapters.
- Programming-language syntax and semantic analysis belong in providers. Unsupported languages must remain browsable as files. Parsing alone must not be presented as resolved semantic relationships.
- Keep the canonical source graph separate from its visible projection, layout positions, camera, and selection state. Presentation changes cannot change source facts.
- The renderer has no direct filesystem access. Use a narrow, runtime-validated IPC API, context isolation, renderer sandboxing, and disabled renderer Node integration.
- Scanning, analysis, and expensive layout work must not block interactive rendering. Use cancellation and bounded concurrency.
- Begin with explicit built-in providers and a single package with enforced import boundaries. Do not introduce a dynamic plugin runtime without a concrete requirement.

## Source consistency requirements

- The selected source is authoritative; the graph is a rebuildable derived view.
- Treat watch events as hints. Re-read affected source and reconcile periodically and after uncertainty or watcher failure.
- Validate asynchronous results against the active session and input generations/revisions. Late results must not overwrite newer data or enter another project session.
- Publish graph updates atomically. Every published edge must reference existing nodes, and deleting entities must remove incident edges.
- Report inaccessible resources, incomplete coverage, pending updates, and errors honestly. Do not equate an access failure with an empty directory or claim instantaneous filesystem consistency.
- Apply ignore and symlink policy consistently to initial scans and subsequent updates. In v0.1, display symbolic links without traversing their targets.
- Keep caches disposable and validated against source inputs. No durable graph cache is required for v0.1.

## Verification

- Run checks appropriate to the changed behavior and current milestone. Once tooling exists, use the repository's documented commands.
- Test domain contracts and meaningful failure modes rather than mirroring implementation details. Keep core tests runnable without Electron or a GPU.
- For synchronization changes, verify that the incrementally maintained graph converges to a fresh rebuild after source activity settles, including missed notifications and out-of-order work.
- For adapter changes, cover relevant path, permission, cancellation, ignore, and symlink behavior. Use temporary fixtures rather than modifying user source directories.
- Record exact checks and outcomes. Distinguish automated checks, manual checks, untested assumptions, and blocked verification. Compilation alone does not establish interactive or synchronization correctness.
- Treat performance figures as provisional until measured on a recorded environment. Never report targets as measured results.

## Session handoff

Before ending an implementation session:

1. Update completed checkboxes in SPEC.md only when their acceptance criteria have evidence.
2. Update STATUS.md with the current milestone, changes, checks and outcomes, unresolved issues, and the next concrete task.
3. Record lasting architectural decisions in DESIGN.md; keep temporary progress in STATUS.md.
4. Update README.md when setup, run, build, or verification commands change.
5. Summarize the delivered behavior and material limitations to the user.

Keep these instructions stable. Put changing progress and milestone state in STATUS.md so future sessions have one current handoff record.
