import type { GraphNode, GraphSnapshot } from '../../core/graph';
import { layoutWeb } from './web';

export type Position = [number, number, number];
export type VisibleNode = {
  node: GraphNode;
  position: Position;
  childCount: number;
};
export type SceneProjection = {
  nodes: VisibleNode[];
  edges: { id: string; source: Position; target: Position }[];
  indexedCount: number;
  hiddenCount: number;
  limitReached: boolean;
};

function compare(a: GraphNode, b: GraphNode) {
  const directoryOrder =
    Number(b.entry.kind === 'directory') - Number(a.entry.kind === 'directory');
  if (directoryOrder) return directoryOrder;
  return a.entry.name < b.entry.name
    ? -1
    : a.entry.name > b.entry.name
      ? 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0;
}

// Pure layout: no Three.js objects, platform APIs, or source mutation. Coordinates
// derive from the canonical tree, so collapse and display caps never move survivors.
export function projectHierarchy(
  snapshot: GraphSnapshot,
  expanded: ReadonlySet<string>,
  maxVisible = 500,
): SceneProjection {
  const limit = Math.max(1, Math.min(2000, Math.floor(maxVisible) || 1));
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const children = new Map<string, GraphNode[]>();
  for (const edge of snapshot.edges) {
    const child = byId.get(edge.target);
    if (child && byId.has(edge.source)) {
      const list = children.get(edge.source) ?? [];
      list.push(child);
      children.set(edge.source, list);
    }
  }
  for (const list of children.values()) list.sort(compare);
  const root = snapshot.nodes.find((node) => node.entry.relativePath === '');
  if (!root)
    return {
      nodes: [],
      edges: [],
      indexedCount: snapshot.nodes.length,
      hiddenCount: snapshot.nodes.length,
      limitReached: false,
    };
  const positions = layoutWeb(root, children);
  const visible: VisibleNode[] = [];
  const pending = [root];
  const emitted = new Set<string>();
  while (pending.length && visible.length < limit) {
    const node = pending.pop()!;
    if (emitted.has(node.id)) continue;
    emitted.add(node.id);
    const list = children.get(node.id) ?? [];
    visible.push({
      node,
      position: positions.get(node.id)!,
      childCount: list.length,
    });
    if (expanded.has(node.id))
      for (let i = list.length - 1; i >= 0; i--) pending.push(list[i]!);
  }
  const edges = snapshot.edges
    .filter((edge) => emitted.has(edge.source) && emitted.has(edge.target))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((edge) => ({
      id: edge.id,
      source: positions.get(edge.source)!,
      target: positions.get(edge.target)!,
    }));
  return {
    nodes: visible,
    edges,
    indexedCount: snapshot.nodes.length,
    hiddenCount: snapshot.nodes.length - visible.length,
    limitReached: pending.length > 0,
  };
}
