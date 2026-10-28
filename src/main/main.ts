import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import type { IpcMainInvokeEvent } from 'electron';
import { ProjectController } from '../application/project';
import { matchesRendererDocument } from './renderer-document';
import { chooseDirectory } from '../adapters/desktop-electron/directory';
import {
  projectChannel,
  projectRequestSchema,
  projectResponseSchema,
  workerEventSchema,
} from '../contracts/project';
import type { ScanEvent } from '../ports/scanner';
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
let scanReceiver:
  | { sessionId: string; receive: (event: ScanEvent) => void }
  | undefined;
let pickerGeneration = 0;
let pickerOpen = false;
const projects = new ProjectController(
  {
    start(request, receive) {
      if (!worker || workerStatus === 'failed') startWorker();
      const target = worker!;
      scanReceiver = { sessionId: request.sessionId, receive };
      target.postMessage({ type: 'scan', schemaVersion: 1, request });
      return () => {
        if (scanReceiver?.sessionId === request.sessionId)
          scanReceiver = undefined;
        target.postMessage({
          type: 'cancel',
          schemaVersion: 1,
          sessionId: request.sessionId,
        });
      };
    },
  },
  randomUUID,
);
const rendererFile = path.join(
  __dirname,
  `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
);
const rendererUrl =
  MAIN_WINDOW_VITE_DEV_SERVER_URL ?? pathToFileURL(rendererFile).href;

function startWorker() {
  if (worker) {
    void worker.terminate();
  }
  worker = new Worker(path.join(__dirname, 'analysis.js'));
  const target = worker;
  workerStatus = 'starting';
  target.on('message', (message: unknown) => {
    if (worker !== target) return;
    if (workerReadySchema.safeParse(message).success) workerStatus = 'ready';
    const parsed = workerEventSchema.safeParse(message);
    if (parsed.success && parsed.data.sessionId === scanReceiver?.sessionId) {
      scanReceiver.receive(parsed.data);
    }
  });
  target.on('error', (error) => {
    if (worker !== target) return;
    console.error('Analysis worker failed:', error);
    workerStatus = 'failed';
    scanReceiver?.receive({
      type: 'failed',
      message: 'Scan worker failed. Refresh to retry.',
    });
  });
  target.on('exit', () => {
    if (worker !== target) return;
    workerStatus = 'failed';
    scanReceiver?.receive({
      type: 'failed',
      message: 'Scan worker stopped. Refresh to retry.',
    });
  });
}

function validateSender(event: IpcMainInvokeEvent) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !matchesRendererDocument(event.senderFrame.url, rendererUrl)
  )
    throw new Error('Untrusted IPC sender');
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
    pickerGeneration++;
    projects.close();
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
      validateSender(event);
      runtimeRequestSchema.parse(request);
      return runtimeResponseSchema.parse({
        schemaVersion: 1,
        ...getRuntimeStatus({ getWorkerStatus: () => workerStatus }),
      });
    });
    ipcMain.handle(projectChannel, async (event, payload: unknown) => {
      validateSender(event);
      const request = projectRequestSchema.parse(payload);
      if (request.command === 'open' && !pickerOpen) {
        pickerOpen = true;
        const generation = ++pickerGeneration;
        const owner = window!;
        try {
          const chosen = await chooseDirectory(owner);
          if (
            chosen &&
            generation === pickerGeneration &&
            window === owner &&
            !owner.isDestroyed()
          )
            projects.open(chosen);
        } finally {
          pickerOpen = false;
        }
      } else if (request.command === 'close') {
        pickerGeneration++;
        projects.close();
      } else if (request.command === 'refresh') {
        pickerGeneration++;
        projects.refresh(request.policy);
      }
      const state = projects.getState();
      return projectResponseSchema.parse({
        schemaVersion: 1,
        state:
          request.command === 'state' && request.knownVersion === state.version
            ? null
            : state,
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
  pickerGeneration++;
  projects.close();
  if (worker) {
    void worker.terminate();
    worker = null;
  }
});
