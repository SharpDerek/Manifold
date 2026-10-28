import { expect, it } from 'vitest';
import { build } from 'vite';
import { Worker } from 'node:worker_threads';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { scanDirectory } from '../src/application/scan-directory';
import { MemoryFileSystem } from '../src/adapters/filesystem-memory/filesystem';
import {
  directoryNode,
  containment,
} from '../src/adapters/analysis-directory/provider';
import { defaultPolicy } from '../src/core/graph';
import type { SceneProjection } from '../src/renderer/layout/hierarchy';

it('bundles the browser layout worker and processes valid and invalid requests off-thread', async () => {
  const base = path.resolve('.cache/test-fixtures');
  await mkdir(base, { recursive: true });
  const fixture = await mkdtemp(path.join(base, 'layout-'));
  let worker: Worker | undefined;
  try {
    const snapshot = await scanDirectory(
      new MemoryFileSystem([
        { path: '', kind: 'directory' },
        { path: 'src', kind: 'directory' },
        { path: 'src/file.ts', kind: 'file' },
      ]),
      { node: directoryNode, edge: containment },
      { rootPath: 'root', sessionId: 'layout', policy: defaultPolicy },
      new AbortController().signal,
    );
    await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        outDir: fixture,
        rollupOptions: {
          input: path.resolve('src/renderer/layout/worker.ts'),
          output: { format: 'cjs', entryFileNames: 'layout.cjs' },
        },
      },
    });
    // Bridge the browser worker's self/onmessage API to a real Node worker so
    // this contract stays runnable without Electron, a DOM, or a GPU.
    worker = new Worker(
      `const { parentPort } = require('node:worker_threads');
      globalThis.self = globalThis;
      self.postMessage = (message) => parentPort.postMessage(message);
      require(${JSON.stringify(path.join(fixture, 'layout.cjs'))});
      parentPort.on('message', (data) => self.onmessage({ data }));`,
      { eval: true },
    );
    const replies: {
      requestId: number;
      projection?: SceneProjection;
      error?: string;
    }[] = [];
    let failure: string | null = null;
    worker.on('message', (message) => replies.push(message));
    worker.on('error', (error) => {
      failure = error.message;
    });
    worker.postMessage({
      requestId: 1,
      snapshot,
      expanded: [snapshot.nodes[0]!.id],
      limit: 500,
    });
    worker.postMessage({
      requestId: 2,
      snapshot,
      expanded: 'invalid',
      limit: 500,
    });
    await expect
      .poll(() => {
        if (failure) throw new Error(failure);
        return replies.length;
      })
      .toBe(2);
    expect(replies[0]?.requestId).toBe(1);
    expect(replies[0]?.projection?.nodes).toHaveLength(2);
    expect(replies[0]?.projection?.hiddenCount).toBe(1);
    expect(replies[1]).toMatchObject({
      requestId: 2,
      error: 'Invalid layout request',
    });
  } finally {
    await worker?.terminate();
    if (path.dirname(path.resolve(fixture)) !== base)
      throw new Error('Unsafe fixture cleanup');
    await rm(fixture, { recursive: true, force: true });
  }
}, 15000);
