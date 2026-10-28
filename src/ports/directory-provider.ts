import type {
  GraphNode,
  GraphEdge,
  ResourceEntry,
  ScanPolicy,
} from '../core/graph';

export interface DirectoryProvider {
  node(entry: ResourceEntry, policy: ScanPolicy): GraphNode;
  edge(parent: GraphNode, child: GraphNode): GraphEdge;
}
