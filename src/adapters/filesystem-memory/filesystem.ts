import type { ResourceEntry } from '../../core/graph';
import type { FileSystemPort, Observation } from '../../ports/filesystem';

export type MemoryEntry = {
  path: string;
  kind: ResourceEntry['kind'];
  inaccessible?: boolean;
  broken?: boolean;
};

// Controllable, case-sensitive source for contract and scheduling tests.
export class MemoryFileSystem implements FileSystemPort {
  constructor(public readonly entries: readonly MemoryEntry[]) {}
  private observe(item: MemoryEntry): ResourceEntry {
    return {
      resource: { namespace: 'memory', key: `root/${item.path}` },
      relativePath: item.path,
      name: item.path.split('/').at(-1) || 'root',
      kind: item.kind,
      size: 0,
      modifiedMs: 0,
      revision: 'fixture:1',
    };
  }
  async resolveRoot(
    rootPath: string,
    signal: AbortSignal,
  ): Promise<Observation<ResourceEntry>> {
    signal.throwIfAborted();
    const root =
      rootPath === 'root'
        ? this.entries.find((item) => item.path === '')
        : undefined;
    if (!root || root.kind !== 'directory')
      return {
        ok: false,
        diagnostic: {
          severity: 'error',
          code: 'INVALID_ROOT',
          resource: null,
          message: 'Root is missing or is not a directory.',
        },
      };
    return { ok: true, value: this.observe(root) };
  }
  async *children(
    directory: ResourceEntry,
    signal: AbortSignal,
  ): AsyncIterable<Observation<ResourceEntry>> {
    signal.throwIfAborted();
    if (
      directory.kind !== 'directory' ||
      directory.resource.namespace !== 'memory'
    )
      throw new Error('Expected a memory directory');
    const source = this.entries.find(
      (item) => item.path === directory.relativePath,
    );
    if (source?.inaccessible) {
      yield {
        ok: false,
        diagnostic: {
          severity: 'error',
          code: 'EACCES',
          message: 'Directory is inaccessible.',
          resource: directory.resource,
        },
      };
      return;
    }
    for (const item of this.entries) {
      signal.throwIfAborted();
      if (
        item.path === '' ||
        item.path.split('/').slice(0, -1).join('/') !== directory.relativePath
      )
        continue;
      const value = this.observe(item);
      yield { ok: true, value };
      if (item.broken)
        yield {
          ok: false,
          diagnostic: {
            severity: 'error',
            code: 'ENOENT',
            message: 'Broken symbolic link.',
            resource: value.resource,
          },
        };
    }
  }
}
