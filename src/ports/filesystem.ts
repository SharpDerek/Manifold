import type { Diagnostic, ResourceEntry } from '../core/graph';

export type Observation<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; diagnostic: Diagnostic }>;

// Enumeration is streamed; no unbounded Promise.all over a directory tree.
export interface FileSystemPort {
  resolveRoot(
    path: string,
    signal: AbortSignal,
  ): Promise<Observation<ResourceEntry>>;
  children(
    directory: ResourceEntry,
    signal: AbortSignal,
  ): AsyncIterable<Observation<ResourceEntry>>;
}
