import { afterEach, describe, expect, it } from 'vitest';
import {
  lstat,
  opendir,
  realpath,
  stat,
  mkdir,
  mkdtemp,
  rm,
  rmdir,
  writeFile,
  symlink,
} from 'node:fs/promises';
import path from 'node:path';
import { NodeFileSystem } from '../src/adapters/filesystem-node/filesystem';
import { MemoryFileSystem } from '../src/adapters/filesystem-memory/filesystem';
import {
  directoryNode,
  containment,
} from '../src/adapters/analysis-directory/provider';
import { scanDirectory } from '../src/application/scan-directory';
import { defaultPolicy, freezeSnapshot } from '../src/core/graph';
import type { FileSystemPort } from '../src/ports/filesystem';

const provider = { node: directoryNode, edge: containment };
const fixtureBase = path.resolve('.cache/test-fixtures');
const created: string[] = [];
async function temporary() {
  await mkdir(fixtureBase, { recursive: true });
  const root = await mkdtemp(path.join(fixtureBase, 'directory-'));
  created.push(root);
  return root;
}
afterEach(async () => {
  for (const root of created.splice(0)) {
    // All recursive cleanup is confined to test-created fixtures in this workspace.
    if (path.dirname(path.resolve(root)) !== fixtureBase)
      throw new Error('Unsafe fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
const scan = (
  fs: FileSystemPort,
  rootPath: string,
  signal = new AbortController().signal,
) =>
  scanDirectory(
    fs,
    provider,
    { rootPath, sessionId: 'test', policy: defaultPolicy },
    signal,
  );

for (const implementation of ['memory', 'node'] as const) {
  describe(`${implementation} filesystem contract`, () => {
    async function fixture(empty = false) {
      if (implementation === 'memory')
        return {
          fs: new MemoryFileSystem([
            { path: '', kind: 'directory' },
            ...(!empty
              ? [
                  { path: 'nested', kind: 'directory' as const },
                  { path: 'nested/日本語.ts', kind: 'file' as const },
                  { path: '.hidden', kind: 'file' as const },
                  { path: 'node_modules', kind: 'directory' as const },
                  { path: 'node_modules/ignored.js', kind: 'file' as const },
                  { path: 'nested/build', kind: 'directory' as const },
                  { path: 'nested/build/ignored.js', kind: 'file' as const },
                  { path: 'dist', kind: 'file' as const },
                ]
              : []),
          ]),
          root: 'root',
        };
      const root = await temporary();
      if (!empty) {
        await mkdir(path.join(root, 'nested/build'), { recursive: true });
        await mkdir(path.join(root, 'node_modules'));
        for (const name of [
          'nested/日本語.ts',
          '.hidden',
          'node_modules/ignored.js',
          'nested/build/ignored.js',
          'dist',
        ])
          await writeFile(path.join(root, name), 'fixture');
      }
      return { fs: new NodeFileSystem(), root };
    }
    it('represents an empty root as one source-derived node', async () => {
      const { fs, root } = await fixture(true);
      const graph = await scan(fs, root);
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]?.entry.relativePath).toBe('');
      expect(graph.nodes[0]?.provenance.provider).toBe('directory');
      expect(graph.edges).toEqual([]);
      expect(graph.coverage).toBe('complete');
    });
    it('scans nested and Unicode files, includes hidden files, and excludes directory names at every depth', async () => {
      const { fs, root } = await fixture();
      const graph = await scan(fs, root);
      expect(graph.nodes.map((node) => node.entry.relativePath).sort()).toEqual(
        ['', '.hidden', 'dist', 'nested', 'nested/日本語.ts'].sort(),
      );
      expect(graph.edges).toHaveLength(graph.nodes.length - 1);
      const ids = new Set(graph.nodes.map((node) => node.id));
      expect(
        graph.edges.every(
          (edge) => ids.has(edge.source) && ids.has(edge.target),
        ),
      ).toBe(true);
      expect(Object.isFrozen(graph)).toBe(true);
      expect(Object.isFrozen(graph.nodes[0]?.entry.resource)).toBe(true);
      const rebuilt = await scan(fs, root);
      expect(rebuilt.nodes.map((node) => node.id).sort()).toEqual(
        [...ids].sort(),
      );
    });
    it('reports missing roots as failures, not empty graphs', async () => {
      const { fs, root } = await fixture();
      await expect(scan(fs, `${root}/missing`)).rejects.toThrow();
    });
    it('honors cancellation before and during enumeration', async () => {
      const { fs, root } = await fixture();
      const abort = new AbortController();
      abort.abort();
      await expect(scan(fs, root, abort.signal)).rejects.toThrow();
      const running = new AbortController();
      const observed = await fs.resolveRoot(root, running.signal);
      if (!observed.ok) throw new Error('fixture root unavailable');
      const iterator = fs
        .children(observed.value, running.signal)
        [Symbol.asyncIterator]();
      expect((await iterator.next()).done).toBe(false);
      running.abort();
      await expect(iterator.next()).rejects.toThrow();
    });
    it('reports inaccessible enumeration honestly and retains the directory node', async () => {
      const { root } = await fixture();
      const fs =
        implementation === 'memory'
          ? new MemoryFileSystem([
              { path: '', kind: 'directory', inaccessible: true },
            ])
          : new NodeFileSystem({
              lstat,
              realpath,
              stat,
              opendir: (async () => {
                throw Object.assign(new Error('fixture access denied'), {
                  code: 'EACCES',
                });
              }) as typeof opendir,
            });
      const graph = await scan(fs, root);
      expect(graph.nodes).toHaveLength(1);
      expect(graph.coverage).toBe('incomplete');
      expect(graph.diagnostics[0]?.code).toBe('EACCES');
    });
    it('supports project-level exclusions on a fresh scan', async () => {
      const { fs, root } = await fixture();
      const graph = await scanDirectory(
        fs,
        provider,
        {
          rootPath: root,
          sessionId: 'policy',
          policy: { excludedDirectoryNames: ['nested'] },
        },
        new AbortController().signal,
      );
      expect(
        graph.nodes.some(
          (node) => node.entry.relativePath === 'node_modules/ignored.js',
        ),
      ).toBe(true);
      expect(
        graph.nodes.some((node) =>
          node.entry.relativePath.startsWith('nested'),
        ),
      ).toBe(false);
    });
    it('retains accessible siblings when a subtree cannot be enumerated', async () => {
      let fs: FileSystemPort;
      let root: string;
      if (implementation === 'memory') {
        root = 'root';
        fs = new MemoryFileSystem([
          { path: '', kind: 'directory' },
          { path: 'restricted', kind: 'directory', inaccessible: true },
          { path: 'readable.txt', kind: 'file' },
        ]);
      } else {
        root = await temporary();
        await mkdir(path.join(root, 'restricted'));
        await writeFile(path.join(root, 'readable.txt'), 'readable');
        fs = new NodeFileSystem({
          lstat,
          realpath,
          stat,
          opendir: (async (directory: string) => {
            if (path.basename(directory) === 'restricted')
              throw Object.assign(new Error('fixture access denied'), {
                code: 'EACCES',
              });
            return opendir(directory);
          }) as typeof opendir,
        });
      }
      const graph = await scan(fs, root);
      expect(graph.nodes.map((node) => node.entry.relativePath).sort()).toEqual(
        ['', 'readable.txt', 'restricted'],
      );
      expect(graph.edges).toHaveLength(2);
      expect(graph.coverage).toBe('incomplete');
      expect(graph.diagnostics).toHaveLength(1);
      expect(graph.diagnostics[0]?.code).toBe('EACCES');
    });
    it('shows links without walking loops, outside targets, or dangling targets', async () => {
      let fs: FileSystemPort;
      let root: string;
      if (implementation === 'memory') {
        root = 'root';
        fs = new MemoryFileSystem([
          { path: '', kind: 'directory' },
          { path: 'loop', kind: 'symlink' },
          { path: 'outside', kind: 'symlink' },
          { path: 'broken', kind: 'symlink', broken: true },
        ]);
      } else {
        const outer = await temporary();
        root = path.join(outer, 'root');
        await mkdir(root);
        await mkdir(path.join(outer, 'outside'));
        await writeFile(path.join(outer, 'outside/secret.txt'), 'outside root');
        const type = process.platform === 'win32' ? 'junction' : 'dir';
        await symlink(root, path.join(root, 'loop'), type);
        await symlink(
          path.join(outer, 'outside'),
          path.join(root, 'outside'),
          type,
        );
        await symlink(
          path.join(outer, 'missing'),
          path.join(root, 'broken'),
          type,
        );
        fs = new NodeFileSystem();
      }
      const graph = await scan(fs, root);
      expect(graph.nodes).toHaveLength(4);
      expect(
        graph.nodes.filter((node) => node.entry.kind === 'symlink'),
      ).toHaveLength(3);
      expect(graph.diagnostics.some((item) => item.code === 'ENOENT')).toBe(
        true,
      );
      expect(graph.coverage).toBe('incomplete');
    });
  });
}

it('keeps case-sensitive adapter keys distinct', async () => {
  const graph = await scan(
    new MemoryFileSystem([
      { path: '', kind: 'directory' },
      { path: 'A.ts', kind: 'file' },
      { path: 'a.ts', kind: 'file' },
    ]),
    'root',
  );
  expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(3);
});

it('rejects dangling provider edges atomically', async () => {
  const graph = await scan(
    new MemoryFileSystem([{ path: '', kind: 'directory' }]),
    'root',
  );
  expect(() =>
    freezeSnapshot({
      ...graph,
      edges: [
        {
          id: 'bad',
          kind: 'contains',
          source: 'missing',
          target: 'also-missing',
          provenance: graph.nodes[0]!.provenance,
        },
      ],
    }),
  ).toThrow('Invalid graph edge');
});

it('detects a directory replaced by a junction before enumeration', async () => {
  const outer = await temporary();
  const root = path.join(outer, 'root');
  const outside = path.join(outer, 'outside');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(path.join(outside, 'secret'), 'outside');
  const fs = new NodeFileSystem();
  const observed = await fs.resolveRoot(root, new AbortController().signal);
  if (!observed.ok) throw new Error('fixture root unavailable');
  await rmdir(root); // Empty test-created directory only.
  await symlink(
    outside,
    root,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const result = [];
  for await (const item of fs.children(
    observed.value,
    new AbortController().signal,
  ))
    result.push(item);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    ok: false,
    diagnostic: { code: 'SOURCE_CHANGED' },
  });
});
