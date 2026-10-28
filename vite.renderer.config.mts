import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // The DOM renderer and the lazy-loaded Fiber renderer must share React's
  // dispatcher. Prebundle the lazy scene upfront to avoid discovery/rebundling
  // introducing a second React runtime into an already running dev session.
  // Keep Forge's development renderer cache separate from other Vite targets.
  cacheDir: '.cache/vite-renderer',
  resolve: { dedupe: ['react', 'react-dom', 'three'], preserveSymlinks: false },
  optimizeDeps: {
    // Layout workers load Zod only after a project is opened. Discovering it at
    // that point can replace shared React chunks while the DOM is still using
    // the previous generation. Optimize every direct browser dependency upfront.
    noDiscovery: true,
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@react-three/fiber',
      'three',
      'three/addons/controls/OrbitControls.js',
      'zod',
    ],
  },
  plugins: [
    react(),
    {
      name: 'development-refresh-csp',
      transformIndexHtml(html) {
        // React Refresh injects an inline preamble in development only.
        return command === 'serve'
          ? html.replace(
              "script-src 'self'",
              "script-src 'self' 'unsafe-inline'",
            )
          : html;
      },
    },
  ],
  base: './',
}));
