import { parentPort } from 'node:worker_threads';
import { NodeFileSystem } from '../adapters/filesystem-node/filesystem';
import {
  directoryNode,
  containment,
} from '../adapters/analysis-directory/provider';
import { scanDirectory } from '../application/scan-directory';
import { workerCommandSchema } from '../contracts/project';
import type { ScanRequest } from '../ports/scanner';

if (!parentPort) throw new Error('Analysis entry must run as a worker');
const port = parentPort;
let active: { sessionId: string; abort: AbortController } | undefined;
let pending: ScanRequest | undefined;
let running = false;

// One scan at a time, with only the latest replacement queued. A canceled OS call
// finishes before the replacement scan begins, bounding work even during bursts.
async function drain() {
  if (running) return;
  running = true;
  try {
    while (pending) {
      const request = pending;
      pending = undefined;
      const task = {
        sessionId: request.sessionId,
        abort: new AbortController(),
      };
      active = task;
      const send = (event: object) => {
        if (active === task && !task.abort.signal.aborted)
          port.postMessage({
            ...event,
            sessionId: task.sessionId,
            schemaVersion: 1,
          });
      };
      try {
        const snapshot = await scanDirectory(
          new NodeFileSystem(),
          { node: directoryNode, edge: containment },
          request,
          task.abort.signal,
          (discovered) => send({ type: 'progress', discovered }),
        );
        send({ type: 'snapshot', snapshot });
      } catch (error) {
        send({
          type: 'failed',
          message: error instanceof Error ? error.message : 'Scan failed.',
        });
      } finally {
        if (active === task) active = undefined;
      }
    }
  } finally {
    running = false;
  }
}

port.postMessage({ type: 'ready', schemaVersion: 1 });
port.on('message', (message: unknown) => {
  const parsed = workerCommandSchema.safeParse(message);
  if (!parsed.success) return;
  const command = parsed.data;
  if (command.type === 'cancel') {
    if (active?.sessionId === command.sessionId) active.abort.abort();
    if (pending?.sessionId === command.sessionId) pending = undefined;
    return;
  }
  active?.abort.abort();
  pending = command.request;
  void drain();
});
