import type { GraphSnapshot, ScanPolicy } from '../core/graph';

export type ScanRequest = Readonly<{
  sessionId: string;
  rootPath: string;
  policy: ScanPolicy;
}>;
export type ScanEvent =
  | Readonly<{ type: 'progress'; discovered: number }>
  | Readonly<{ type: 'snapshot'; snapshot: GraphSnapshot }>
  | Readonly<{ type: 'failed'; message: string }>;
export interface ScannerPort {
  start(request: ScanRequest, receive: (event: ScanEvent) => void): () => void;
}
