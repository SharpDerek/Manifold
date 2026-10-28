import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'node:worker_threads',
        'node:fs/promises',
        'node:path',
        'node:url',
      ],
      output: { format: 'cjs', entryFileNames: 'analysis.js' },
    },
  },
});
