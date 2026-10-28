import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.vite/**',
      'out/**',
      '.cache/**',
      'coverage/**',
    ],
  },
  ...tseslint.configs.recommended,
);
