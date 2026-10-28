module.exports = {
  packagerConfig: { asar: true, executableName: 'Manifold' },
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['win32'] }],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          { entry: 'src/main/main.ts', config: 'vite.main.config.mts' },
          {
            entry: 'src/preload/preload.ts',
            config: 'vite.preload.config.mts',
          },
          {
            entry: 'src/workers/analysis.ts',
            config: 'vite.worker.config.mts',
          },
        ],
        renderer: [{ name: 'main_window', config: 'vite.renderer.config.mts' }],
      },
    },
  ],
};
