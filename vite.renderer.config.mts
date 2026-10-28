import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
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
