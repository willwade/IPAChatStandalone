import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['config.default.json', 'images/favicon.png'],
      manifest: {
        name: 'IPA Chat',
        short_name: 'IPA Chat',
        description: 'IPA phoneme communication aid',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#1976d2',
        icons: [
          { src: 'images/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'images/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'images/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        // The cues/ example image set is large (8MB+); don't force-precache it.
        // Files are still deployed and fetched on demand when a config uses them.
        globIgnores: ['images/cues/**'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
