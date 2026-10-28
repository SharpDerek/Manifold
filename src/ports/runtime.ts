import type { WorkerStatus } from '../core/runtime';

export interface RuntimePort {
  getWorkerStatus(): WorkerStatus;
}
