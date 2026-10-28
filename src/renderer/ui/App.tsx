import { useEffect, useState } from 'react';

export function App() {
  const [status, setStatus] = useState('Connecting');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const response = await window.manifold.getRuntimeStatus();
        if (!active) return;
        setStatus(
          response.worker === 'ready'
            ? 'Ready'
            : response.worker === 'failed'
              ? 'Worker unavailable'
              : 'Starting worker',
        );
        if (response.worker === 'starting')
          timer = setTimeout(() => void check(), 500);
      } catch {
        if (active) setStatus('Connection unavailable');
      }
    }
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [retry]);

  return (
    <div className="shell">
      <header>
        <span className="brand">MANIFOLD</span>
        <span className="badge">Directory explorer</span>
      </header>
      <main>
        <div className="mark" aria-hidden="true">
          M
        </div>
        <p className="eyebrow">A new perspective on your project</p>
        <h1>
          Explore the structure.
          <br />
          Follow the connections.
        </h1>
        <p className="description">
          Your workspace will begin with a local directory. Files and folders
          will become a navigable three-dimensional map.
        </p>
        <button
          disabled
          title="Directory opening will be added in the next milestone"
        >
          Open directory
        </button>
        <p className="hint">
          Directory scanning is coming next. No project is open.
        </p>
      </main>
      <footer>
        <span role="status">Application: {status}</span>
        <button
          className="text-button"
          onClick={() => {
            setStatus('Connecting');
            setRetry((value) => value + 1);
          }}
        >
          Check connection
        </button>
        <span>Local workspace · v0.1</span>
      </footer>
    </div>
  );
}
