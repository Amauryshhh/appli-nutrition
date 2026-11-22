import { chargerParametres, enregistrerParametres, reinitialiserParametres } from '../db.js';
import { lireNombre, formaterNombre, html } from './outils.js';

// Chaque ligne : [chemin dans l'objet paramètres, libellé]
const LIGNES = [
  { titre: "Facteurs d'activité (× métabolisme de base)" },
  [['facteursActivite', 'sedentaire'], 'Sédentaire'],
  [['facteursActivite', 'leger'], 'Léger'],
  [['facteursActivite', 'modere'], 'Modéré'],
  [['facteursActivite', 'actif'], 'Actif'],
  [['facteursActivite', 'tres_actif'], 'Très actif'],
  { titre: 'Objectif (× dépense journalière)' },
  [['multiplicateursObjectif', 'seche'], 'Sèche'],
  [['multiplicateursObjectif', 'maintien'], 'Maintien'],
  [['multiplicateursObjectif', 'prise_de_masse'], 'Prise de masse'],
  { titre: 'Macros (g par kg de poids)' },
  [['proteinesParKg'], 'Protéines'],
  [['lipidesParKg'], 'Lipides'],
];

const lire = (obj, chemin) => chemin.reduce((o, c) => o[c], obj);
function ecrire(obj, chemin, valeur) {
  const dernier = chemin.at(-1);
  const parent = chemin.slice(0, -1).reduce((o, c) => o[c], obj);
  parent[dernier] = valeur;
}

export async function afficherParametres(conteneur) {
  const params = await chargerParametres();

  const vue = html(`<section>
    <h1>Paramètres</h1>
    <p class="note">Les glucides prennent les calories qui restent après les protéines et les lipides.</p>
    <form class="formulaire" autocomplete="off">
      ${LIGNES.map((l, i) =>
        l.titre
          ? `<h2>${l.titre}</h2>`
          : `<div class="ligne">
               <label for="p${i}">${l[1]}</label>
               <input id="p${i}" data-index="${i}" type="text" inputmode="decimal"
                      value="${formaterNombre(lire(params, l[0]))}" />
             </div>`,
      ).join('')}
    </form>
    <button type="button" class="bouton secondaire" id="defaut">Revenir aux valeurs par défaut</button>
    <p class="note" id="statut"></p>
  </section>`);
  conteneur.append(vue);

  const statut = vue.querySelector('#statut');

  vue.querySelectorAll('input').forEach((input) =>
    input.addEventListener('input', async () => {
      const n = lireNombre(input.value);
      // On n'enregistre que des valeurs positives : un champ vide ne casse pas les calculs.
      if (n === undefined || n <= 0) {
        statut.textContent = 'Valeur invalide, non enregistrée';
        return;
      }
      ecrire(params, LIGNES[input.dataset.index][0], n);
      await enregistrerParametres(params);
      statut.textContent = 'Enregistré ✓';
    }),
  );

  vue.querySelector('#defaut').addEventListener('click', async () => {
    if (!confirm('Remettre tous les coefficients par défaut ?')) return;
    await reinitialiserParametres();
    conteneur.innerHTML = '';
    afficherParametres(conteneur);
  });
}
