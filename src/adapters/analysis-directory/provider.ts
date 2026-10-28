import type {
  GraphNode,
  GraphEdge,
  ResourceEntry,
  ScanPolicy,
} from '../../core/graph';

export const directoryProvider = Object.freeze({
  id: 'directory',
  version: '1',
  nodeKinds: ['directory', 'file', 'symlink'],
  edgeKinds: ['contains'],
  invalidation: 'whole-project',
});

export function directoryNode(
  entry: ResourceEntry,
  policy: ScanPolicy,
): GraphNode {
  return {
    id: JSON.stringify([
      directoryProvider.id,
      entry.resource.namespace,
      entry.resource.key,
    ]),
    entry,
    provenance: {
      provider: directoryProvider.id,
      version: directoryProvider.version,
      configuration: JSON.stringify([...policy.excludedDirectoryNames].sort()),
      inputRevision: entry.revision,
    },
  };
}
export function containment(parent: GraphNode, child: GraphNode): GraphEdge {
  return {
    id: JSON.stringify(['contains', parent.id, child.id]),
    kind: 'contains',
    source: parent.id,
    target: child.id,
    provenance: parent.provenance,
  };
}
