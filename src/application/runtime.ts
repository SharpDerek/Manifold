import type { RuntimePort } from '../ports/runtime';

export function getRuntimeStatus(runtime: RuntimePort) {
  return { worker: runtime.getWorkerStatus() };
}
