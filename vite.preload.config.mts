import { defineConfig } from 'vite';

// Bundle all local dependencies: sandboxed preload cannot require local modules.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: 'preload.js',
        inlineDynamicImports: true,
      },
    },
  },
});
