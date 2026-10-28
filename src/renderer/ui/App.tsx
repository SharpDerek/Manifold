import { useEffect, useRef, useState } from 'react';
import type { ProjectState } from '../../core/graph';
import type { ProjectRequest } from '../../contracts/project';
import { Explorer } from './Explorer';

export function App() {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [worker, setWorker] = useState('Connecting');
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [excluded, setExcluded] = useState('');
  const version = useRef(-1);
  const session = useRef<string | null>(null);
  function accept(state: ProjectState | null) {
    if (!state || state.version <= version.current) return;
    version.current = state.version;
    if (state.sessionId !== session.current) {
      session.current = state.sessionId;
      setExcluded(state.policy.excludedDirectoryNames.join(', '));
    }
    setProject(state);
  }
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const [runtime, state] = await Promise.all([
          window.manifold.getRuntimeStatus(),
          window.manifold.project({
            schemaVersion: 1,
            command: 'state',
            knownVersion: version.current,
          }),
        ]);
        if (!active) return;
        setWorker(
          runtime.worker === 'ready'
            ? 'Ready'
            : runtime.worker === 'failed'
              ? 'Worker unavailable'
              : 'Starting worker',
        );
        accept(state);
      } catch {
        if (active) setWorker('Connection unavailable');
      } finally {
        if (active) timer = setTimeout(() => void poll(), 500);
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  async function command(request: ProjectRequest) {
    setError(null);
    if (request.command === 'open') setChoosing(true);
    try {
      accept(await window.manifold.project(request));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Command failed.');
    } finally {
      if (request.command === 'open') setChoosing(false);
    }
  }
  const nodes = project?.snapshot?.nodes ?? [];
  const diagnostics = project?.snapshot?.diagnostics ?? [];
  const open = project?.sessionId != null;
  const projectPanel = (
    <>
      <div className="panel-section project-controls">
        <p className="eyebrow">Workspace</p>
        <h2 className="brand">MANIFOLD</h2>
        <button
          disabled={choosing}
          onClick={() => void command({ schemaVersion: 1, command: 'open' })}
        >
          {choosing ? 'Choosing directory…' : 'Open directory'}
        </button>
        {open && (
          <>
            <p className="root-path" title={project.rootPath ?? ''}>
              {project.rootPath}
            </p>
            <p className="scan-status" role="status" aria-live="polite">
              {project.status === 'scanning'
                ? `Scanning — ${project.discovered} entries…`
                : project.status === 'failed'
                  ? 'Scan failed'
                  : project.status === 'incomplete'
                    ? `Incomplete scan — ${nodes.length} entries`
                    : `Scanned — ${nodes.length} entries, ${project.snapshot?.edges.length ?? 0} edges`}
            </p>
            <button
              className="secondary-button"
              onClick={() =>
                void command({ schemaVersion: 1, command: 'close' })
              }
            >
              Close project
            </button>
            <details className="scan-settings">
              <summary>Scan settings</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const names = [
                    ...new Set(
                      excluded
                        .split(',')
                        .map((name) => name.trim())
                        .filter(Boolean),
                    ),
                  ];
                  void command({
                    schemaVersion: 1,
                    command: 'refresh',
                    policy: { excludedDirectoryNames: names },
                  });
                }}
              >
                <label htmlFor="exclusions">Excluded directory names</label>
                <input
                  id="exclusions"
                  value={excluded}
                  onChange={(event) => setExcluded(event.target.value)}
                />
                <p className="hint">
                  Comma-separated, exact names at any depth. Hidden entries are
                  included; .gitignore rules are not read. Links are not
                  traversed.
                </p>
                <button type="submit">
                  {project.status === 'scanning'
                    ? 'Restart scan'
                    : 'Refresh with settings'}
                </button>
              </form>
            </details>
            <button
              className="secondary-button"
              onClick={() =>
                void command({
                  schemaVersion: 1,
                  command: 'refresh',
                  policy: {
                    excludedDirectoryNames: [
                      ...project.policy.excludedDirectoryNames,
                    ],
                  },
                })
              }
            >
              {project.status === 'scanning' ? 'Restart scan' : 'Refresh'}
            </button>
            <p className="hint">External changes require Refresh.</p>
          </>
        )}
        {project?.error && (
          <p role="alert" className="error">
            {project.error}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
      {diagnostics.length > 0 && (
        <details className="panel-section" aria-label="Scan diagnostics">
          <summary>Coverage diagnostics ({diagnostics.length})</summary>
          <p className="hint">
            Showing the first {Math.min(100, diagnostics.length)}.
          </p>
          <ul>
            {diagnostics.slice(0, 100).map((item, index) => (
              <li key={index}>{item.message}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="panel-section connection-status">
        <span role="status">Application: {worker}</span>
        <span>Local workspace · v0.1</span>
      </div>
    </>
  );
  return (
    <div className="shell">
      <main className="workspace">
        {project?.snapshot ? (
          <Explorer
            key={project.snapshot.sessionId}
            snapshot={project.snapshot}
            projectPanel={projectPanel}
          />
        ) : (
          <>
            <div className="workspace-empty">
              <div className="mark" aria-hidden="true">
                M
              </div>
              <p className="eyebrow">A new perspective on your project</p>
              <h1>
                {open
                  ? project.status === 'failed'
                    ? 'Unable to scan directory.'
                    : 'Discovering your directory…'
                  : 'Start with a directory.'}
              </h1>
              <p className="description">
                {open
                  ? 'Scan progress and project controls are in the sidebar.'
                  : 'Open a local directory to explore its files, folders, and connections in 3D.'}
              </p>
            </div>
            <aside
              className="sidebar right-sidebar empty-sidebar"
              aria-label="Project controls"
            >
              {projectPanel}
            </aside>
          </>
        )}
      </main>
    </div>
  );
}
