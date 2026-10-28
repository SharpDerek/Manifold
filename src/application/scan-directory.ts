import { freezeSnapshot } from '../core/graph';
import type {
  Diagnostic,
  GraphNode,
  GraphEdge,
  GraphSnapshot,
  ScanPolicy,
} from '../core/graph';
import type { FileSystemPort } from '../ports/filesystem';
import type { DirectoryProvider } from '../ports/directory-provider';

export async function scanDirectory(
  fs: FileSystemPort,
  provider: DirectoryProvider,
  input: { sessionId: string; rootPath: string; policy: ScanPolicy },
  signal: AbortSignal,
  progress: (count: number) => void = () => {},
): Promise<GraphSnapshot> {
  signal.throwIfAborted();
  const root = await fs.resolveRoot(input.rootPath, signal);
  signal.throwIfAborted();
  if (!root.ok) throw new Error(root.diagnostic.message);
  const rootNode = provider.node(root.value, input.policy);
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  const pending = [rootNode];
  const excluded = new Set(input.policy.excludedDirectoryNames);
  progress(1);
  while (pending.length) {
    signal.throwIfAborted();
    const parent = pending.pop()!;
    for await (const result of fs.children(parent.entry, signal)) {
      signal.throwIfAborted();
      if (!result.ok) {
        diagnostics.push(result.diagnostic);
        continue;
      }
      const entry = result.value;
      if (entry.kind === 'directory' && excluded.has(entry.name)) continue;
      const node = provider.node(entry, input.policy);
      nodes.push(node);
      edges.push(provider.edge(parent, node));
      if (entry.kind === 'directory') pending.push(node);
      if (nodes.length % 100 === 0) progress(nodes.length);
    }
  }
  signal.throwIfAborted();
  return freezeSnapshot({
    sessionId: input.sessionId,
    revision: 1,
    root: root.value.resource,
    nodes,
    edges,
    diagnostics,
    coverage: diagnostics.length ? 'incomplete' : 'complete',
  });
}
