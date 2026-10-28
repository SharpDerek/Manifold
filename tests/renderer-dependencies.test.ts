import { expect, it } from 'vitest';
import { createServer, optimizeDeps, resolveConfig } from 'vite';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

it('prebundles React DOM and the lazy Fiber renderer against one shared React module', async () => {
  const base = path.resolve('.cache/test-fixtures');
  await mkdir(base, { recursive: true });
  const fixture = await mkdtemp(path.join(base, 'renderer-deps-'));
  try {
    const config = await resolveConfig(
      {
        configFile: path.resolve('vite.renderer.config.mts'),
        cacheDir: fixture,
        logLevel: 'silent',
        optimizeDeps: { entries: [] },
      },
      'serve',
    );
    const metadata = await optimizeDeps(config, true, true);
    const sharedReact = [];
    for (const dependency of [
      'react',
      'react-dom/client',
      '@react-three/fiber',
    ]) {
      const optimized = metadata.optimized[dependency];
      expect(
        optimized,
        `${dependency} must be ready before the lazy scene loads`,
      ).toBeDefined();
      const code = await readFile(optimized!.file, 'utf8');
      const sharedImport = code.match(
        /import\s*\{\s*require_react\s*\}\s*from\s*["']([^"']+)["']/,
      );
      expect(
        sharedImport,
        `${dependency} must import the shared React chunk`,
      ).not.toBeNull();
      sharedReact.push(sharedImport![1]);
    }
    expect(new Set(sharedReact).size).toBe(1);
  } finally {
    if (path.dirname(path.resolve(fixture)) !== base)
      throw new Error('Unsafe fixture cleanup');
    await rm(fixture, { recursive: true, force: true });
  }
}, 20000);

it('keeps dependency generations stable when opening a project loads the scene and layout worker', async () => {
  const base = path.resolve('.cache/test-fixtures');
  await mkdir(base, { recursive: true });
  const fixture = await mkdtemp(path.join(base, 'renderer-startup-'));
  const server = await createServer({
    configFile: path.resolve('vite.renderer.config.mts'),
    cacheDir: fixture,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const optimizer = server.environments.client!.depsOptimizer!;
    await optimizer.init();
    const main = await server.transformRequest('/src/renderer/main.tsx');
    const initialHash = optimizer.metadata.browserHash;
    const scene = await server.transformRequest(
      '/src/renderer/graph/GraphCanvas.tsx',
    );
    const worker = await server.transformRequest(
      '/src/renderer/layout/worker.ts?worker_file&type=module',
    );
    const contracts = await server.transformRequest(
      '/src/contracts/project.ts',
    );
    expect(main?.code).toContain('react-dom_client.js?v=');
    expect(scene?.code).toContain('@react-three_fiber.js?v=');
    expect(worker?.code).toContain('/src/contracts/project.ts');
    expect(contracts?.code).toContain('zod.js?v=');
    const version = (code: string, dependency: string) =>
      code.match(new RegExp(`${dependency}\\.js\\?v=([a-f0-9]+)`))?.[1];
    expect(version(main!.code, 'react-dom_client')).toBeDefined();
    expect(version(scene!.code, '@react-three_fiber')).toBe(
      version(main!.code, 'react-dom_client'),
    );
    expect(version(contracts!.code, 'zod')).toBe(
      version(main!.code, 'react-dom_client'),
    );
    expect(optimizer.metadata.browserHash).toBe(initialHash);
    expect(Object.keys(optimizer.metadata.discovered)).toEqual([]);
  } finally {
    await server.close();
    if (path.dirname(path.resolve(fixture)) !== base)
      throw new Error('Unsafe fixture cleanup');
    await rm(fixture, { recursive: true, force: true });
  }
}, 20000);
