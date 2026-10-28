import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { checkImport, checkTree } from '../scripts/check-boundaries.mjs';

test('core, application and renderer reject platform/framework dependencies', () => {
  for (const [file, dependency] of [
    ['core/model.ts', 'node:fs'],
    ['core/model.ts', 'react'],
    ['application/project.ts', '../adapters/filesystem-node/index'],
    ['renderer/ui/App.tsx', 'electron'],
    ['renderer/ui/App.tsx', '../../main/main'],
    ['ports/files.ts', 'node:path'],
    ['core/model.ts', '../../outside'],
  ])
    assert.ok(
      checkImport(file, dependency),
      `${file} must reject ${dependency}`,
    );
  assert.equal(checkImport('application/project.ts', '../ports/files'), null);
  assert.equal(
    checkImport('renderer/ui/App.tsx', '../../contracts/runtime'),
    null,
  );
});

test('scanner catches an intentionally forbidden import in a real fixture', async () => {
  const fixture = await mkdtemp(path.resolve('.boundary-fixture-'));
  try {
    await mkdir(path.join(fixture, 'core'));
    await writeFile(
      path.join(fixture, 'core', 'bad.ts'),
      "import fs from 'node:fs';\n",
    );
    const errors = await checkTree(fixture);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /forbidden external dependency node:fs/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
