import { lstat, opendir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Stats } from 'node:fs';
import type { Diagnostic, ResourceEntry, ResourceRef } from '../../core/graph';
import type { FileSystemPort, Observation } from '../../ports/filesystem';

function reference(fullPath: string): ResourceRef {
  return { namespace: 'filesystem', key: pathToFileURL(fullPath).href };
}
function entry(
  fullPath: string,
  relativePath: string,
  metadata: Stats,
): ResourceEntry {
  return {
    resource: reference(fullPath),
    relativePath,
    name: path.basename(fullPath) || fullPath,
    kind: metadata.isSymbolicLink()
      ? 'symlink'
      : metadata.isDirectory()
        ? 'directory'
        : 'file',
    size: metadata.size,
    modifiedMs: metadata.mtimeMs,
    revision: `${metadata.dev}:${metadata.ino}:${metadata.mode}:${metadata.size}:${metadata.mtimeMs}:${metadata.ctimeMs}`,
  };
}
function diagnostic(error: unknown, resource: ResourceRef): Diagnostic {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'IO_ERROR';
  return {
    code,
    severity: 'error',
    message: `${code}: Unable to inspect ${resource.key}`,
    resource,
  };
}

export class NodeFileSystem implements FileSystemPort {
  constructor(private readonly io = { lstat, opendir, realpath, stat }) {}
  async resolveRoot(
    rootPath: string,
    signal: AbortSignal,
  ): Promise<Observation<ResourceEntry>> {
    signal.throwIfAborted();
    const absolute = path.resolve(rootPath);
    try {
      const metadata = await this.io.lstat(absolute);
      signal.throwIfAborted();
      if (metadata.isSymbolicLink() || !metadata.isDirectory())
        return {
          ok: false,
          diagnostic: {
            severity: 'error',
            code: 'INVALID_ROOT',
            resource: reference(absolute),
            message:
              'Select a real directory; symbolic-link roots are not traversed.',
          },
        };
      const canonical = await this.io.realpath(absolute);
      signal.throwIfAborted();
      const current = await this.io.lstat(canonical);
      signal.throwIfAborted();
      if (!current.isDirectory() || current.isSymbolicLink())
        return {
          ok: false,
          diagnostic: {
            severity: 'error',
            code: 'SOURCE_CHANGED',
            message: 'Root changed during observation. Refresh to retry.',
            resource: reference(canonical),
          },
        };
      return { ok: true, value: entry(canonical, '', current) };
    } catch (error) {
      signal.throwIfAborted();
      return { ok: false, diagnostic: diagnostic(error, reference(absolute)) };
    }
  }

  async *children(
    directory: ResourceEntry,
    signal: AbortSignal,
  ): AsyncIterable<Observation<ResourceEntry>> {
    signal.throwIfAborted();
    if (
      directory.resource.namespace !== 'filesystem' ||
      directory.kind !== 'directory'
    )
      throw new Error('Expected a filesystem directory');
    const absolute = fileURLToPath(directory.resource.key);
    try {
      // Reject replacements by symlinks/junctions or a redirected ancestor before enumeration.
      const metadata = await this.io.lstat(absolute);
      const canonical = await this.io.realpath(absolute);
      signal.throwIfAborted();
      if (
        metadata.isSymbolicLink() ||
        !metadata.isDirectory() ||
        reference(canonical).key !== directory.resource.key
      ) {
        yield {
          ok: false,
          diagnostic: {
            severity: 'error',
            code: 'SOURCE_CHANGED',
            resource: directory.resource,
            message: `Directory changed during scan: ${directory.relativePath || directory.name}. Refresh to retry.`,
          },
        };
        return;
      }
      // opendir closes its handle even on cancellation or an early iterator return.
      const handle = await this.io.opendir(absolute);
      for await (const child of handle) {
        signal.throwIfAborted();
        const fullPath = path.join(absolute, child.name);
        const relativePath = directory.relativePath
          ? `${directory.relativePath}/${child.name}`
          : child.name;
        try {
          const metadata = await this.io.lstat(fullPath);
          signal.throwIfAborted();
          if (
            !metadata.isDirectory() &&
            !metadata.isFile() &&
            !metadata.isSymbolicLink()
          ) {
            yield {
              ok: false,
              diagnostic: {
                severity: 'error',
                code: 'UNSUPPORTED_ENTRY',
                resource: reference(fullPath),
                message: `Special filesystem entry is not indexed: ${relativePath}`,
              },
            };
            continue;
          }
          yield { ok: true, value: entry(fullPath, relativePath, metadata) };
          if (metadata.isSymbolicLink()) {
            // Only inspect target existence; never enumerate or read target contents.
            try {
              await this.io.stat(fullPath);
            } catch (error) {
              signal.throwIfAborted();
              yield {
                ok: false,
                diagnostic: diagnostic(error, reference(fullPath)),
              };
            }
          }
        } catch (error) {
          signal.throwIfAborted();
          yield {
            ok: false,
            diagnostic: diagnostic(error, reference(fullPath)),
          };
        }
      }
    } catch (error) {
      signal.throwIfAborted();
      yield { ok: false, diagnostic: diagnostic(error, directory.resource) };
    }
  }
}
