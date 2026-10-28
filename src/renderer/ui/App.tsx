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
  return (
    <div className="shell">
      <header>
        <span className="brand">MANIFOLD</span>
        <span className="badge">Directory explorer</span>
        <button
          disabled={choosing}
          onClick={() => void command({ schemaVersion: 1, command: 'open' })}
        >
          {choosing ? 'Choosing directory…' : 'Open directory'}
        </button>
        {open && (
          <button
            className="text-button"
            onClick={() => void command({ schemaVersion: 1, command: 'close' })}
          >
            Close project
          </button>
        )}
      </header>
      <main className={open ? 'project' : ''}>
        {!open ? (
          <>
            <div className="mark" aria-hidden="true">
              M
            </div>
            <p className="eyebrow">A new perspective on your project</p>
            <h1>Start with a directory.</h1>
            <p className="description">
              Open a local directory to index its files, folders, and symbolic
              links. Your source files remain unchanged.
            </p>
          </>
        ) : (
          <>
            <h1>{project.rootPath}</h1>
            <p role="status" aria-live="polite">
              {project.status === 'scanning'
                ? `Scanning — ${project.discovered} entries discovered…`
                : project.status === 'failed'
                  ? 'Scan failed'
                  : project.status === 'incomplete'
                    ? `Incomplete scan — ${nodes.length} entries`
                    : `Scanned — ${nodes.length} entries, ${project.snapshot?.edges.length ?? 0} containment edges`}
            </p>
            <p className="hint">
              This is an on-demand scan. External changes require Refresh.
            </p>
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
              <label htmlFor="exclusions">
                Excluded directory names (comma-separated)
              </label>
              <div className="policy-controls">
                <input
                  id="exclusions"
                  value={excluded}
                  onChange={(event) => setExcluded(event.target.value)}
                />
                <button type="submit">
                  {project.status === 'scanning' ? 'Restart scan' : 'Refresh'}
                </button>
              </div>
              <p className="hint">
                Exact directory names at any depth. Hidden entries are included;
                .gitignore rules are not read. Symbolic links and junctions are
                shown without traversing their targets.
              </p>
            </form>
            {project.error && (
              <p role="alert" className="error">
                {project.error}
              </p>
            )}
            {project.snapshot && (
              <>
                <Explorer
                  key={project.snapshot.sessionId}
                  snapshot={project.snapshot}
                />
                {diagnostics.length > 0 && (
                  <section aria-label="Scan diagnostics">
                    <h2>Coverage diagnostics ({diagnostics.length})</h2>
                    <p className="hint">
                      Showing the first {Math.min(100, diagnostics.length)}{' '}
                      diagnostics.
                    </p>
                    <ul>
                      {diagnostics.slice(0, 100).map((item, index) => (
                        <li key={index}>{item.message}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </main>
      <footer>
        <span role="status">Application: {worker}</span>
        <span>Local workspace · v0.1</span>
      </footer>
    </div>
  );
}
