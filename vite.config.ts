import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png', 'icon.png', 'icons/*.png', 'icons/*.webp'],
        manifest: {
          name: 'Flow Day',
          short_name: 'Flow Day',
          description: 'Flow Day - One Stop of Daily Personal Productivity',
          start_url: '/',
          scope: '/',
          id: '/',
          display: 'standalone',
          background_color: '#121212',
          theme_color: '#121212',
          icons: [
            {
              src: '/icons/icon-48.png',
              type: 'image/png',
              sizes: '48x48',
              purpose: 'any',
            },
            {
              src: '/icons/icon-72.png',
              type: 'image/png',
              sizes: '72x72',
              purpose: 'any',
            },
            {
              src: '/icons/icon-96.png',
              type: 'image/png',
              sizes: '96x96',
              purpose: 'any',
            },
            {
              src: '/icons/icon-128.png',
              type: 'image/png',
              sizes: '128x128',
              purpose: 'any',
            },
            {
              src: '/icons/icon-192.png',
              type: 'image/png',
              sizes: '192x192',
              purpose: 'any',
            },
            {
              src: '/icons/icon-256.png',
              type: 'image/png',
              sizes: '256x256',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              type: 'image/png',
              sizes: '512x512',
              purpose: 'any',
            },
            {
              src: '/icons/icon-192.png',
              type: 'image/png',
              sizes: '192x192',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-512.png',
              type: 'image/png',
              sizes: '512x512',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json,woff,woff2}'],
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: 'index.html',
          clientsClaim: true,
          skipWaiting: true,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
