export type ResourceRef = Readonly<{ namespace: string; key: string }>;
export type ResourceEntry = Readonly<{
  resource: ResourceRef;
  relativePath: string;
  name: string;
  kind: 'directory' | 'file' | 'symlink';
  size: number;
  modifiedMs: number;
  revision: string;
}>;
export type Diagnostic = Readonly<{
  severity: 'warning' | 'error';
  code: string;
  message: string;
  resource: ResourceRef | null;
}>;
export type ScanPolicy = Readonly<{
  excludedDirectoryNames: readonly string[];
}>;
export const defaultPolicy: ScanPolicy = Object.freeze({
  excludedDirectoryNames: Object.freeze([
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
  ]),
});
export type Provenance = Readonly<{
  provider: string;
  version: string;
  configuration: string;
  inputRevision: string;
}>;
export type GraphNode = Readonly<{
  id: string;
  entry: ResourceEntry;
  provenance: Provenance;
}>;
export type GraphEdge = Readonly<{
  id: string;
  kind: 'contains';
  source: string;
  target: string;
  provenance: Provenance;
}>;
export type GraphSnapshot = Readonly<{
  sessionId: string;
  revision: number;
  root: ResourceRef;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  diagnostics: readonly Diagnostic[];
  coverage: 'complete' | 'incomplete';
}>;
export type ProjectState = Readonly<{
  version: number;
  sessionId: string | null;
  rootPath: string | null;
  status: 'empty' | 'scanning' | 'scanned' | 'incomplete' | 'failed';
  discovered: number;
  policy: ScanPolicy;
  snapshot: GraphSnapshot | null;
  error: string | null;
}>;

// Published source facts are immutable, independently of renderer state.
export function freezeSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  if (
    !snapshot.nodes.some(
      (node) =>
        node.entry.relativePath === '' &&
        node.entry.resource.namespace === snapshot.root.namespace &&
        node.entry.resource.key === snapshot.root.key,
    )
  )
    throw new Error('Graph root is missing');
  const ids = new Set(snapshot.nodes.map((node) => node.id));
  if (ids.size !== snapshot.nodes.length)
    throw new Error('Duplicate graph node');
  const edgeIds = new Set<string>();
  for (const edge of snapshot.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edgeIds.has(edge.id))
      throw new Error('Invalid graph edge');
    edgeIds.add(edge.id);
  }
  return freezeData(snapshot);
}

export function freezeData<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}
