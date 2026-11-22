import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Sur GitHub Pages, l'appli est servie dans un sous-dossier :
// https://<ton-pseudo>.github.io/appli-nutrition/
// « base » doit donc correspondre au NOM DU DÉPÔT GitHub.
const BASE = '/appli-nutrition/';

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      // Le service worker se met à jour tout seul quand une nouvelle version est publiée.
      registerType: 'autoUpdate',
      // Fichiers du dossier public/ à mettre en cache en plus du code.
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Nutrition',
        short_name: 'Nutrition',
        description: 'Suivi nutritionnel et menus de la semaine',
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone', // plein écran, sans la barre de Safari
        orientation: 'portrait',
        background_color: '#f4f7f2',
        theme_color: '#2e7d32',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout ce qui est construit (JS, CSS, HTML, images) est gardé pour le hors ligne.
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
      },
    }),
  ],
});
