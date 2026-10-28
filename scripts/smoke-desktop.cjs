/* eslint-disable @typescript-eslint/no-require-imports -- Electron smoke entry must load the CommonJS production bundle. */
// Run with Electron after production compilation. Uses only disposable fixtures.
const { app, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const base = path.resolve('.cache/desktop-smoke');
app.setPath('userData', path.join(base, 'profile'));
app.setPath('sessionData', path.join(base, 'profile'));
let selected = null;
dialog.showOpenDialog = async () =>
  selected
    ? { canceled: false, filePaths: [selected] }
    : { canceled: true, filePaths: [] };
const deadline = setTimeout(() => {
  console.error('Desktop smoke timed out');
  app.exit(1);
}, 20000);
let fixture;

app.once('browser-window-created', (_event, window) => {
  window.hide();
  window.webContents.once('did-finish-load', () => {
    void verify(window);
  });
});

async function verify(window) {
  let exitCode = 0;
  try {
    await fs.mkdir(base, { recursive: true });
    fixture = await fs.mkdtemp(path.join(base, 'fixture-'));
    await fs.mkdir(path.join(fixture, 'nested'));
    await fs.writeFile(
      path.join(fixture, 'nested/hello.txt'),
      'desktop fixture',
    );
    const preferences = window.webContents.getLastWebPreferences();
    assert.equal(preferences.sandbox, true);
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.nodeIntegration, false);
    const evaluate = (code) => window.webContents.executeJavaScript(code);
    assert.equal(await evaluate('typeof require'), 'undefined');
    const command = (request) =>
      evaluate(
        `window.manifold.project(${JSON.stringify({ schemaVersion: 1, ...request })})`,
      );
    let state = await command({ command: 'state', knownVersion: -1 });
    assert.equal(state.status, 'empty');
    selected = fixture;
    await command({ command: 'open' });
    async function scanned() {
      for (let attempt = 0; attempt < 100; attempt++) {
        const current = await command({ command: 'state', knownVersion: -1 });
        if (current.status === 'failed') throw new Error(current.error);
        if (current.status === 'scanned') return current;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error('Scan did not finish');
    }
    state = await scanned();
    assert.deepEqual(
      state.snapshot.nodes.map((node) => node.entry.relativePath).sort(),
      ['', 'nested', 'nested/hello.txt'],
    );
    assert.equal(state.snapshot.edges.length, 2);
    async function waitForUi(code) {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(code)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`Desktop UI did not settle: ${code}`);
    }
    await waitForUi(
      `document.querySelector('canvas[data-graph-ready="true"]') !== null && document.querySelector('.projection-status')?.textContent.includes('2 visible / 3 indexed')`,
    );
    await evaluate(
      `document.querySelector('.entry-actions button[aria-expanded="false"]').click()`,
    );
    await waitForUi(
      `document.querySelector('.projection-status')?.textContent.includes('3 visible / 3 indexed')`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('.entry-button')).find(button => button.textContent.includes('nested/hello.txt')).click()`,
    );
    await waitForUi(
      `document.querySelector('.selection-details')?.textContent.includes('nested/hello.txt')`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('.explorer-toolbar button')).find(button => button.textContent.startsWith('Focus selection')).click()`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('.explorer-toolbar button')).find(button => button.textContent.startsWith('Reset view')).click()`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('tr')).find(row => row.querySelector('.entry-button')?.textContent.trim() === '■ nested').querySelector('button[aria-expanded]').click()`,
    );
    await waitForUi(
      `document.querySelector('.projection-status')?.textContent.includes('2 visible / 3 indexed') && document.querySelector('.selection-details')?.textContent.includes('Select a node')`,
    );
    state = await command({ command: 'state', knownVersion: -1 });
    assert.equal(state.snapshot.nodes.length, 3);
    assert.equal(state.snapshot.edges.length, 2);
    const beforeCancel = state.sessionId;
    selected = null;
    state = await command({ command: 'open' });
    assert.equal(state.sessionId, beforeCancel);
    await command({
      command: 'refresh',
      policy: { excludedDirectoryNames: ['nested'] },
    });
    state = await scanned();
    assert.equal(state.snapshot.nodes.length, 1);
    assert.notEqual(state.sessionId, beforeCancel);
    state = await command({ command: 'close' });
    assert.equal(state.status, 'empty');
    assert.equal(state.snapshot, null);
    await assert.rejects(() => command({ command: 'open', path: fixture }));
    console.log(
      'Desktop smoke passed: sandbox, preload IPC, scan, WebGL scene, layout worker, expand/collapse, selection/details, focus/reset commands, source immutability, picker cancellation, policy refresh, close, payload rejection.',
    );
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    clearTimeout(deadline);
    if (fixture) {
      if (path.dirname(path.resolve(fixture)) !== base)
        throw new Error('Unsafe fixture cleanup');
      await fs.rm(fixture, { recursive: true, force: true });
    }
    app.exit(exitCode);
  }
}

// Forge production output must exist; this exercises the actual composition root and preload.
require(path.resolve('.vite/build/main.js'));
