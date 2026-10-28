import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        'node:path',
        'node:url',
        'node:worker_threads',
        'node:crypto',
      ],
      output: { format: 'cjs', entryFileNames: 'main.js' },
    },
  },
});
