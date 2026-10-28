import { describe, expect, it } from 'vitest';
import { freezeSnapshot } from '../src/core/graph';
import type { GraphNode, GraphSnapshot } from '../src/core/graph';
import { projectHierarchy } from '../src/renderer/layout/hierarchy';
import { minimumNodeSpacing } from '../src/renderer/layout/web';

const provenance = {
  provider: 'directory',
  version: '1',
  configuration: 'test',
  inputRevision: '1',
};
function node(
  id: string,
  kind: GraphNode['entry']['kind'],
  name = id,
): GraphNode {
  return {
    id,
    entry: {
      resource: { namespace: 'fixture', key: id },
      relativePath: id === 'root' ? '' : id,
      name,
      kind,
      size: 10,
      modifiedMs: 0,
      revision: '1',
    },
    provenance,
  };
}
function graph(
  nodes: GraphNode[],
  relations: [string, string][],
): GraphSnapshot {
  return freezeSnapshot({
    sessionId: 'test',
    revision: 1,
    root: { namespace: 'fixture', key: 'root' },
    nodes,
    edges: relations.map(([source, target]) => ({
      id: `${source}:${target}`,
      kind: 'contains',
      source,
      target,
      provenance,
    })),
    diagnostics: [],
    coverage: 'complete',
  });
}
function fixture() {
  return graph(
    [
      node('root', 'directory'),
      node('src', 'directory'),
      node('empty', 'directory'),
      node('readme', 'file', 'README.md'),
      node('link', 'symlink'),
      node('a', 'file'),
      node('nested', 'directory'),
      node('deep', 'file'),
    ],
    [
      ['root', 'src'],
      ['root', 'readme'],
      ['root', 'empty'],
      ['root', 'link'],
      ['src', 'a'],
      ['src', 'nested'],
      ['nested', 'deep'],
    ],
  );
}
const ids = (projection: ReturnType<typeof projectHierarchy>) =>
  projection.nodes.map((item) => item.node.id);

describe('directory projection and layout', () => {
  it('spreads siblings across three dimensions with varied branch lengths', () => {
    const files = Array.from({ length: 64 }, (_, i) =>
      node(`file-${i}`, 'file'),
    );
    const source = graph(
      [node('root', 'directory'), ...files],
      files.map((file) => ['root', file.id]),
    );
    const result = projectHierarchy(source, new Set(['root']));
    const positions = result.nodes.slice(1).map((item) => item.position);
    for (const axis of [0, 1, 2]) {
      const values = positions.map((position) => position[axis]!);
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(20);
      expect(
        new Set(values.map((value) => value.toFixed(1))).size,
      ).toBeGreaterThan(32);
    }
    expect(
      new Set(positions.map((position) => Math.hypot(...position).toFixed(1)))
        .size,
    ).toBeGreaterThan(10);
  });
  it('keeps nodes separated across overlapping directory branches', () => {
    const folders = Array.from({ length: 6 }, (_, i) =>
      node(`folder-${i}`, 'directory'),
    );
    const nodes = [node('root', 'directory'), ...folders];
    const edges: [string, string][] = folders.map((folder) => [
      'root',
      folder.id,
    ]);
    for (const folder of folders)
      for (let i = 0; i < 20; i++) {
        const file = node(`${folder.id}-file-${i}`, 'file');
        nodes.push(file);
        edges.push([folder.id, file.id]);
      }
    const source = graph(nodes, edges);
    const result = projectHierarchy(
      source,
      new Set(['root', ...folders.map((folder) => folder.id)]),
    );
    expect(result.hiddenCount).toBe(0);
    for (let i = 0; i < result.nodes.length; i++)
      for (let j = i + 1; j < result.nodes.length; j++) {
        const a = result.nodes[i]!.position;
        const b = result.nodes[j]!.position;
        expect(
          Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
        ).toBeGreaterThanOrEqual(minimumNodeSpacing - 1e-8);
      }
  });
  it('uses source identity rather than fresh randomness or the session ID to place nodes', () => {
    const source = fixture();
    const expanded = new Set(source.nodes.map((item) => item.id));
    expect(
      projectHierarchy({ ...source, sessionId: 'reopened-session' }, expanded),
    ).toEqual(projectHierarchy(source, expanded));
  });
  it('initially exposes only the root and immediate children, directories first', () => {
    const result = projectHierarchy(fixture(), new Set(['root']));
    expect(ids(result)).toEqual(['root', 'empty', 'src', 'readme', 'link']);
    expect(result.hiddenCount).toBe(3);
    expect(result.limitReached).toBe(false);
    expect(
      result.nodes.find((item) => item.node.id === 'src')?.childCount,
    ).toBe(2);
  });
  it('expands progressively, including nested descendants only when their parent is expanded', () => {
    const source = fixture();
    expect(ids(projectHierarchy(source, new Set(['root', 'src'])))).toEqual([
      'root',
      'empty',
      'src',
      'nested',
      'a',
      'readme',
      'link',
    ]);
    const all = projectHierarchy(source, new Set(['root', 'src', 'nested']));
    expect(all.hiddenCount).toBe(0);
    expect(ids(all)).toContain('deep');
  });
  it('collapse removes descendants and incident visible edges without changing source facts', () => {
    const source = fixture();
    const before = JSON.stringify(source);
    const collapsed = projectHierarchy(source, new Set(['root', 'nested']));
    expect(ids(collapsed)).not.toContain('deep');
    expect(collapsed.edges).toHaveLength(4);
    expect(JSON.stringify(source)).toBe(before);
    expect(source.nodes).toHaveLength(8);
    expect(Object.isFrozen(source.nodes)).toBe(true);
  });
  it('keeps positions of surviving nodes identical across collapse, expansion, and display limits', () => {
    const source = fixture();
    const all = projectHierarchy(source, new Set(['root', 'src', 'nested']));
    for (const result of [
      projectHierarchy(source, new Set(['root'])),
      projectHierarchy(source, new Set(['root', 'src']), 4),
    ]) {
      for (const item of result.nodes)
        expect(item.position).toEqual(
          all.nodes.find((other) => other.node.id === item.node.id)?.position,
        );
    }
  });
  it('is repeatable even when equivalent source arrays arrive in a different order', () => {
    const source = fixture();
    const reordered = {
      ...source,
      nodes: [...source.nodes].reverse(),
      edges: [...source.edges].reverse(),
    };
    const expanded = new Set(['root', 'src', 'nested']);
    const first = projectHierarchy(source, expanded);
    const second = projectHierarchy(reordered, expanded);
    expect(second).toEqual(first);
  });
  it('caps visible nodes honestly and emits only edges whose endpoints are visible', () => {
    const source = fixture();
    const result = projectHierarchy(
      source,
      new Set(['root', 'src', 'nested']),
      4,
    );
    expect(result.nodes).toHaveLength(4);
    expect(result.hiddenCount).toBe(4);
    expect(result.limitReached).toBe(true);
    const positions = new Set(result.nodes.map((item) => item.position));
    expect(
      result.edges.every(
        (edge) => positions.has(edge.source) && positions.has(edge.target),
      ),
    ).toBe(true);
    expect(result.indexedCount).toBe(source.nodes.length);
  });
  it('retains an empty root, and supports collapsing even the root itself', () => {
    const empty = projectHierarchy(
      graph([node('root', 'directory')], []),
      new Set(['root']),
    );
    expect(ids(empty)).toEqual(['root']);
    expect(empty.nodes[0]?.position).toEqual([0, 0, 0]);
    expect(empty.hiddenCount).toBe(0);
    expect(ids(projectHierarchy(fixture(), new Set()))).toEqual(['root']);
  });
  it('ignores expansion IDs absent from the snapshot without introducing source nodes', () => {
    const source = fixture();
    expect(projectHierarchy(source, new Set(['root', 'unknown']))).toEqual(
      projectHierarchy(source, new Set(['root'])),
    );
  });
  it('does not traverse link targets', () => {
    const source = fixture();
    expect(projectHierarchy(source, new Set(['root', 'link']))).toEqual(
      projectHierarchy(source, new Set(['root'])),
    );
  });
  it('handles deep and broad trees without recursion, unbounded rendering, or nonfinite coordinates', () => {
    const count = 12000;
    const nodes = [
      node('root', 'directory'),
      ...Array.from({ length: count }, (_, index) =>
        node(`n${index}`, 'directory'),
      ),
    ];
    const chain = graph(
      nodes,
      Array.from({ length: count }, (_, i) => [
        i === 0 ? 'root' : `n${i - 1}`,
        `n${i}`,
      ]),
    );
    const expanded = new Set(nodes.map((item) => item.id));
    const deep = projectHierarchy(chain, expanded, 2000);
    expect(deep.nodes).toHaveLength(2000);
    expect(deep.limitReached).toBe(true);
    expect(
      deep.nodes.every((item) => item.position.every(Number.isFinite)),
    ).toBe(true);
    const wide = projectHierarchy(
      graph(
        nodes,
        nodes.slice(1).map((item) => ['root', item.id]),
      ),
      new Set(['root']),
      999999,
    );
    expect(wide.nodes).toHaveLength(2000);
    expect(wide.hiddenCount).toBe(count + 1 - 2000);
  });
});
