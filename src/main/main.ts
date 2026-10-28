import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { getRuntimeStatus } from '../application/runtime';
import type { WorkerStatus } from '../core/runtime';
import {
  runtimeChannel,
  runtimeRequestSchema,
  runtimeResponseSchema,
  workerReadySchema,
} from '../contracts/runtime';

let window: BrowserWindow | null = null;
let worker: Worker | null = null;
let workerStatus: WorkerStatus = 'starting';
const rendererFile = path.join(
  __dirname,
  `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
);
const rendererUrl =
  MAIN_WINDOW_VITE_DEV_SERVER_URL ?? pathToFileURL(rendererFile).href;

function startWorker() {
  worker = new Worker(path.join(__dirname, 'analysis.js'));
  worker.on('message', (message: unknown) => {
    if (workerReadySchema.safeParse(message).success) workerStatus = 'ready';
  });
  worker.on('error', (error) => {
    console.error('Analysis worker failed:', error);
    workerStatus = 'failed';
  });
  worker.on('exit', () => {
    workerStatus = 'failed';
  });
}

async function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: 'Manifold',
    backgroundColor: '#10151e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.on('closed', () => {
    window = null;
  });
  await window.loadURL(rendererUrl);
}

app
  .whenReady()
  .then(async () => {
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    ipcMain.handle(runtimeChannel, (event, request: unknown) => {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== rendererUrl
      ) {
        throw new Error('Untrusted IPC sender');
      }
      runtimeRequestSchema.parse(request);
      return runtimeResponseSchema.parse({
        schemaVersion: 1,
        ...getRuntimeStatus({ getWorkerStatus: () => workerStatus }),
      });
    });
    startWorker();
    await createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  })
  .catch((error: unknown) => {
    console.error(error);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  if (worker) {
    void worker.terminate();
    worker = null;
  }
});
