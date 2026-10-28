import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node:worker_threads'],
      output: { format: 'cjs', entryFileNames: 'analysis.js' },
    },
  },
});
