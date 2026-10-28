import { expect, it } from 'vitest';
import { build } from 'vite';
import { Worker } from 'node:worker_threads';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { workerEventSchema } from '../src/contracts/project';
import { workerReadySchema } from '../src/contracts/runtime';
import { defaultPolicy } from '../src/core/graph';

it('bundles and runs the actual scan worker, rejects obsolete work, and reports missing roots', async () => {
  const base = path.resolve('.cache/test-fixtures');
  await mkdir(base, { recursive: true });
  const fixture = await mkdtemp(path.join(base, 'worker-'));
  let worker: Worker | undefined;
  try {
    const first = path.join(fixture, 'first');
    const second = path.join(fixture, 'second');
    await mkdir(first);
    await mkdir(second);
    await writeFile(path.join(second, '日本語.txt'), 'worker fixture');
    const outDir = path.join(fixture, 'bundle');
    await build({
      configFile: path.resolve('vite.worker.config.mts'),
      logLevel: 'silent',
      build: {
        outDir,
        rollupOptions: { input: path.resolve('src/workers/analysis.ts') },
      },
    });
    const messages: unknown[] = [];
    worker = new Worker(path.join(outDir, 'analysis.js'));
    const target = worker;
    let failure: Error | undefined;
    target.on('message', (message: unknown) => messages.push(message));
    target.on('error', (error) => {
      failure = error;
    });
    await expect
      .poll(() => {
        if (failure) throw new Error(failure.message);
        return messages.some(
          (message) => workerReadySchema.safeParse(message).success,
        );
      })
      .toBe(true);
    target.postMessage({
      type: 'scan',
      schemaVersion: 1,
      request: { sessionId: 'first', rootPath: first, policy: defaultPolicy },
    });
    target.postMessage({
      type: 'cancel',
      schemaVersion: 1,
      sessionId: 'first',
    });
    target.postMessage({
      type: 'scan',
      schemaVersion: 1,
      request: { sessionId: 'second', rootPath: second, policy: defaultPolicy },
    });
    const events = () =>
      messages.flatMap((message) => {
        const parsed = workerEventSchema.safeParse(message);
        return parsed.success ? [parsed.data] : [];
      });
    await expect
      .poll(() => {
        if (failure) throw new Error(failure.message);
        return events().find(
          (event) => event.type === 'snapshot' && event.sessionId === 'second',
        );
      })
      .toBeDefined();
    expect(
      events().some(
        (event) => event.type === 'snapshot' && event.sessionId === 'first',
      ),
    ).toBe(false);
    const result = events().find(
      (event) => event.type === 'snapshot' && event.sessionId === 'second',
    );
    if (result?.type !== 'snapshot') throw new Error('Snapshot missing');
    expect(
      result.snapshot.nodes.map((node) => node.entry.relativePath).sort(),
    ).toEqual(['', '日本語.txt']);
    expect(result.snapshot.edges).toHaveLength(1);
    target.postMessage({
      type: 'scan',
      schemaVersion: 1,
      request: {
        sessionId: 'missing',
        rootPath: path.join(fixture, 'missing'),
        policy: defaultPolicy,
      },
    });
    await expect
      .poll(() =>
        events().some(
          (event) => event.type === 'failed' && event.sessionId === 'missing',
        ),
      )
      .toBe(true);
  } finally {
    await worker?.terminate();
    if (path.dirname(path.resolve(fixture)) !== base)
      throw new Error('Unsafe fixture cleanup');
    await rm(fixture, { recursive: true, force: true });
  }
}, 15000);
