import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { afficherProfil } from './vues/profil.js';
import { afficherParametres } from './vues/parametres.js';

// Service worker (fourni par vite-plugin-pwa) : mode hors ligne + mises à jour automatiques.
if ('serviceWorker' in navigator) registerSW({ immediate: true });

const vues = {
  profil: afficherProfil,
  parametres: afficherParametres,
};

const conteneur = document.getElementById('vue');
const boutons = document.querySelectorAll('.onglets button');

function ouvrir(nom) {
  boutons.forEach((b) => b.classList.toggle('actif', b.dataset.onglet === nom));
  conteneur.innerHTML = '';
  window.scrollTo(0, 0);
  vues[nom](conteneur);
}

boutons.forEach((b) => b.addEventListener('click', () => ouvrir(b.dataset.onglet)));
ouvrir('profil');
