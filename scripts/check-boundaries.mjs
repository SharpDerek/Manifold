import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowed = {
  core: ['core'],
  ports: ['ports', 'core'],
  contracts: ['contracts', 'core'],
  application: ['application', 'core', 'ports'],
  adapters: ['adapters', 'ports', 'core'],
  main: ['main', 'adapters', 'application', 'ports', 'contracts', 'core'],
  preload: ['preload', 'contracts', 'core'],
  workers: ['workers', 'application', 'adapters', 'ports', 'contracts', 'core'],
  renderer: ['renderer', 'contracts', 'core'],
};
const external = {
  core: [],
  ports: [],
  application: [],
  contracts: ['zod'],
  preload: ['electron'],
  renderer: [
    'react',
    'react-dom',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    'zod',
  ],
};

export function checkImport(file, specifier) {
  const normalized = file.replaceAll('\\', '/');
  const layer = normalized.split('/')[0];
  if (!allowed[layer]) return `Unknown source layer: ${file}`;
  if (normalized.startsWith('renderer/layout/')) {
    if (!specifier.startsWith('.'))
      return `${file}: forbidden external dependency ${specifier} in layout`;
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(normalized), specifier),
    );
    if (
      !['renderer/layout/', 'core/', 'contracts/'].some((prefix) =>
        target.startsWith(prefix),
      )
    )
      return `${file}: forbidden layout dependency on ${specifier}`;
  }
  if (specifier.startsWith('.')) {
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(normalized), specifier),
    );
    const targetLayer = target.split('/')[0];
    if (!allowed[layer].includes(targetLayer))
      return `${file}: forbidden dependency on ${specifier}`;
  } else {
    const dependencies = external[layer];
    if (
      dependencies &&
      !dependencies.some(
        (entry) => specifier === entry || specifier.startsWith(`${entry}/`),
      )
    ) {
      return `${file}: forbidden external dependency ${specifier}`;
    }
  }
  return null;
}

export async function checkTree(root) {
  const errors = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        const content = await readFile(full, 'utf8');
        // Covers static imports/re-exports, side-effect imports, require and import().
        const pattern =
          /\b(?:import|export)\s+(?:[^;'"]*?\s+from\s*)?['"]([^'"]+)['"]|\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]/g;
        for (const match of content.matchAll(pattern)) {
          const error = checkImport(
            path.relative(root, full),
            match[1] ?? match[2],
          );
          if (error) errors.push(error);
        }
        if (/\b(?:require|import)\s*\(\s*[^'"\s]/.test(content))
          errors.push(
            `${full}: computed module imports require an explicit architectural review`,
          );
      }
    }
  }
  await visit(root);
  return errors;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = await checkTree(path.resolve('src'));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Source dependency boundaries passed.');
}
