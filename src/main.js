import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { db } from './db.js';

function afficher(id, texte, ok) {
  const el = document.getElementById(id);
  el.textContent = texte;
  el.className = ok ? 'ok' : 'ko';
}

// 1. Vérifie que la base Dexie s'ouvre (IndexedDB disponible sur ce navigateur).
db.open()
  .then(() => afficher('statut-db', 'Base de données : prête ✓', true))
  .catch((err) => afficher('statut-db', 'Base de données : erreur (' + err.message + ')', false));

// 2. Enregistre le service worker (fourni par vite-plugin-pwa) pour le hors ligne.
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady: () => afficher('statut-sw', 'Mode hors ligne : prêt ✓', true),
    onRegisteredSW: () => afficher('statut-sw', 'Mode hors ligne : actif ✓', true),
    onRegisterError: () => afficher('statut-sw', 'Mode hors ligne : erreur', false),
  });
} else {
  afficher('statut-sw', 'Mode hors ligne : non supporté ici', false);
}

// 3. Indique si l'appli tourne depuis l'écran d'accueil (PWA) ou dans Safari.
const installee =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
afficher(
  'statut-mode',
  installee ? "Affichage : appli installée ✓" : 'Affichage : dans le navigateur',
  installee,
);
