import { parentPort } from 'node:worker_threads';

if (!parentPort) throw new Error('Analysis entry must run as a worker');
parentPort.postMessage({ type: 'ready', schemaVersion: 1 });
// Keep the worker available. Source acquisition commands will be added in M1.
parentPort.on('message', () => {});
