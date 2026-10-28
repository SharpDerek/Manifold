import { useEffect, useRef, useState } from 'react';
import type { GraphSnapshot } from '../../core/graph';
import type { SceneProjection } from '../layout/hierarchy';
import type { ReactNode } from 'react';
import { GraphCanvas } from '../graph/GraphCanvas';
const symbols = { directory: '■', file: '●', symlink: '◆' };

export function Explorer({
  snapshot,
  projectPanel,
}: {
  snapshot: GraphSnapshot;
  projectPanel: ReactNode;
}) {
  const rootId =
    snapshot.nodes.find((node) => node.entry.relativePath === '')?.id ?? '';
  const [expanded, setExpanded] = useState(() => new Set([rootId]));
  const [selectedId, setSelectedId] = useState<string | null>(rootId);
  const [projection, setProjection] = useState<SceneProjection | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(true);
  const [limit, setLimit] = useState(500);
  const [page, setPage] = useState(0);
  const [reset, setReset] = useState(0);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(
    null,
  );
  const [hierarchyOpen, setHierarchyOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const sequence = useRef(0);
  const focusSequence = useRef(0);
  useEffect(() => {
    setUpdating(true);
    setLayoutError(null);
    const requestId = ++sequence.current;
    // Terminating the previous worker cancels obsolete layout, including CPU work.
    let worker: Worker;
    try {
      worker = new Worker(new URL('../layout/worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      setLayoutError('Directory layout could not be prepared. Try Refresh.');
      setUpdating(false);
      return;
    }
    worker.onmessage = (
      event: MessageEvent<{
        requestId: number;
        projection?: SceneProjection;
        error?: string;
      }>,
    ) => {
      if (event.data.requestId !== sequence.current) return;
      setUpdating(false);
      if (event.data.error) setLayoutError(event.data.error);
      else if (event.data.projection) {
        const result = event.data.projection;
        setProjection(result);
        setSelectedId((current) =>
          result.nodes.some((item) => item.node.id === current)
            ? current
            : null,
        );
      }
    };
    worker.onerror = () => {
      if (requestId === sequence.current) {
        setLayoutError(
          'Directory layout failed. Try changing the visible-node limit.',
        );
        setUpdating(false);
      }
    };
    worker.postMessage({ requestId, snapshot, expanded: [...expanded], limit });
    return () => {
      sequence.current++;
      worker.terminate();
    };
  }, [snapshot, expanded, limit]);
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function focusNode(id: string) {
    setSelectedId(id);
    setFocus({ id, nonce: ++focusSequence.current });
  }
  const selected = projection?.nodes.find(
    (item) => item.node.id === selectedId,
  );
  const pages = Math.max(1, Math.ceil((projection?.nodes.length ?? 0) / 100));
  const currentPage = Math.min(page, pages - 1);

  return (
    <section
      className="explorer"
      aria-label="Directory explorer"
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(
            event.target.tagName,
          )
        )
          return;
        if (event.key.toLowerCase() === 'f' && selected) {
          event.preventDefault();
          focusNode(selected.node.id);
        }
        if (event.key.toLowerCase() === 'r') {
          event.preventDefault();
          setReset((value) => value + 1);
        }
      }}
    >
      <div className="graph-canvas" aria-busy={updating}>
        {projection ? (
          <GraphCanvas
            projection={projection}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onFocus={focusNode}
            focus={focus}
            reset={reset}
          />
        ) : (
          <p>Preparing directory layout…</p>
        )}
      </div>
      {!hierarchyOpen && (
        <button
          className="panel-toggle left-toggle"
          aria-expanded={false}
          onClick={() => setHierarchyOpen(true)}
        >
          Show hierarchy
        </button>
      )}
      {!inspectorOpen && (
        <button
          className="panel-toggle right-toggle"
          aria-expanded={false}
          onClick={() => setInspectorOpen(true)}
        >
          Show inspector
        </button>
      )}
      {hierarchyOpen && (
        <aside
          className="sidebar left-sidebar"
          aria-label="Directory hierarchy"
        >
          <div className="sidebar-heading">
            <h2>Hierarchy</h2>
            <button
              className="icon-button"
              aria-label="Hide hierarchy"
              aria-expanded={true}
              onClick={() => setHierarchyOpen(false)}
            >
              ‹
            </button>
          </div>
          <div className="hierarchy-controls">
            <p className="hierarchy-root" title={snapshot.nodes[0]?.entry.name}>
              {snapshot.nodes.find((node) => node.id === rootId)?.entry.name}
            </p>
            <button
              className="secondary-button"
              disabled={updating}
              onClick={() => {
                setExpanded(new Set([rootId]));
                setSelectedId(rootId);
                setPage(0);
              }}
            >
              Show top level
            </button>
            <p className="projection-status" role="status" aria-live="polite">
              {updating ? 'Updating visible graph… ' : ''}
              {projection &&
                `${projection.nodes.length} visible / ${projection.indexedCount} indexed; ${projection.hiddenCount} hidden by collapsed folders or the display limit.`}
              {projection?.limitReached &&
                ' Display limit reached. Collapse a branch or raise the limit in the inspector.'}
            </p>
            {layoutError && (
              <p role="alert" className="error">
                {layoutError}
              </p>
            )}
          </div>
          <nav
            className="directory-list"
            aria-label="Visible directory entries"
          >
            <ul className="hierarchy-list">
              {projection?.nodes
                .slice(currentPage * 100, (currentPage + 1) * 100)
                .map((item) => {
                  const depth = item.node.entry.relativePath
                    ? item.node.entry.relativePath.split('/').length
                    : 0;
                  const folder = item.node.entry.kind === 'directory';
                  return (
                    <li
                      key={item.node.id}
                      className={`hierarchy-row ${item.node.id === selectedId ? 'selected-row' : ''}`}
                      data-entry-path={item.node.entry.relativePath}
                      style={{
                        paddingLeft: `${8 + Math.min(depth, 8) * 14}px`,
                      }}
                    >
                      {folder ? (
                        <button
                          className="tree-toggle"
                          disabled={updating || item.childCount === 0}
                          aria-expanded={expanded.has(item.node.id)}
                          aria-label={`${expanded.has(item.node.id) ? 'Collapse' : 'Expand'} ${item.node.entry.name}`}
                          onClick={() => toggle(item.node.id)}
                        >
                          {expanded.has(item.node.id) ? '▾' : '▸'}
                        </button>
                      ) : (
                        <span className="tree-spacer" />
                      )}
                      <button
                        className="entry-button"
                        aria-pressed={item.node.id === selectedId}
                        title={`${item.node.entry.relativePath || '(root)'} — ${item.node.entry.kind}`}
                        onClick={() => setSelectedId(item.node.id)}
                        onDoubleClick={() => focusNode(item.node.id)}
                      >
                        <span
                          className={`entry-symbol ${item.node.entry.kind}`}
                          aria-hidden="true"
                        >
                          {symbols[item.node.entry.kind]}
                        </span>
                        <span className="entry-name">
                          {item.node.entry.name}
                        </span>
                      </button>
                      <button
                        className="row-focus"
                        aria-label={`Focus ${item.node.entry.name}`}
                        title="Focus in 3D"
                        onClick={() => focusNode(item.node.id)}
                      >
                        ◎
                      </button>
                    </li>
                  );
                })}
            </ul>
          </nav>
          {pages > 1 && (
            <div className="list-pagination">
              <button
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <button
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </aside>
      )}
      {inspectorOpen && (
        <aside className="sidebar right-sidebar" aria-label="Inspector">
          <div className="sidebar-heading">
            <h2>Inspector</h2>
            <button
              className="icon-button"
              aria-label="Hide inspector"
              aria-expanded={true}
              onClick={() => setInspectorOpen(false)}
            >
              ›
            </button>
          </div>
          <div className="inspector-content">
            <section
              className="panel-section selection-details"
              aria-label="Selection details"
            >
              <h2>Selection</h2>
              {selected ? (
                <>
                  <h3>
                    {symbols[selected.node.entry.kind]}{' '}
                    {selected.node.entry.name}
                  </h3>
                  <dl>
                    <dt>Root-relative path</dt>
                    <dd>{selected.node.entry.relativePath || '(root)'}</dd>
                    <dt>Kind</dt>
                    <dd>{selected.node.entry.kind}</dd>
                    <dt>Size</dt>
                    <dd>
                      {selected.node.entry.kind === 'file'
                        ? `${selected.node.entry.size.toLocaleString()} bytes`
                        : 'Not applicable'}
                    </dd>
                    <dt>Modified</dt>
                    <dd>
                      {new Date(
                        selected.node.entry.modifiedMs,
                      ).toLocaleString()}
                    </dd>
                  </dl>
                  {selected.node.entry.kind === 'directory' && (
                    <>
                      <p>{selected.childCount} indexed immediate children</p>
                      <button
                        className="secondary-button"
                        disabled={updating || selected.childCount === 0}
                        onClick={() => toggle(selected.node.id)}
                      >
                        {expanded.has(selected.node.id)
                          ? 'Collapse folder'
                          : 'Expand folder'}
                      </button>
                    </>
                  )}
                  {selected.node.entry.kind === 'symlink' && (
                    <p className="hint">Target is not traversed.</p>
                  )}
                </>
              ) : (
                <p>Select a node in the graph or hierarchy.</p>
              )}
            </section>
            <section
              className="panel-section explorer-toolbar"
              aria-label="View controls"
            >
              <h2>View</h2>
              <button
                disabled={!selected || updating}
                onClick={() => selected && focusNode(selected.node.id)}
              >
                Focus selection (F)
              </button>
              <button
                className="secondary-button"
                onClick={() => setReset((value) => value + 1)}
              >
                Reset view (R)
              </button>
              <label>
                Visible-node limit{' '}
                <select
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                >
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={2000}>2,000</option>
                </select>
              </label>
            </section>
            <details className="panel-section controls-help">
              <summary>Navigation & legend</summary>
              <p>
                Left-drag: orbit · Right-drag: pan · Wheel: zoom · Click: select
                · Double-click: focus.
              </p>
              <p>
                Focus the canvas to pan with arrows. F focuses the selection; R
                fits the visible graph. Tab through the hierarchy to select and
                expand folders. Touch: one finger orbits; two fingers pan and
                zoom.
              </p>
              <p className="legend">
                <span>■ Folder (box)</span>
                <span>● File (sphere)</span>
                <span>◆ Link (diamond)</span>
                <span>White / larger: selected</span>
              </p>
              <p>Labels are limited to 40, including the selection.</p>
            </details>
            {projectPanel}
          </div>
        </aside>
      )}
    </section>
  );
}
