import {
  listerIngredients,
  chargerIngredient,
  enregistrerIngredient,
  supprimerIngredient,
  basculerFavori,
} from '../db.js';
import {
  CATEGORIES,
  filtrerIngredients,
  validerIngredient,
  ecartCalories,
} from '../calculs/ingredients.js';
import { nettoyerCodeBarres } from '../calculs/openfoodfacts.js';
import { lireNombre, formaterNombre, echapper, html } from './outils.js';
import { ouvrirScan } from './scan.js';

const FILTRES = [['tous', 'Tous'], ['favoris', '★ Favoris'], ...CATEGORIES, ['exclus', 'Exclus']];

// Champs numériques du formulaire : [clé, libellé, obligatoire ?]
const CHAMPS = [
  ['kcal', 'Énergie (kcal)', true],
  ['proteines', 'Protéines (g)', true],
  ['glucides', 'Glucides (g)', true],
  ['sucres', '… dont sucres (g)', false],
  ['lipides', 'Lipides (g)', true],
  ['fibres', 'Fibres (g)', false],
];

// Filtre et recherche gardés en mémoire quand on revient d'une fiche vers la liste.
const etat = { recherche: '', filtre: 'tous' };

// ======================= Liste =======================

export async function afficherIngredients(conteneur) {
  const tous = await listerIngredients();

  const vue = html(`<section>
    <h1>Ingrédients</h1>
    <input type="search" class="recherche" placeholder="Rechercher…" value="${echapper(etat.recherche)}" />
    <div class="pastilles">
      ${FILTRES.map(([v, l]) => `<button type="button" data-filtre="${v}" class="${v === etat.filtre ? 'actif' : ''}">${l}</button>`).join('')}
    </div>
    <ul class="liste"></ul>
    <div class="actions-flottantes">
      <button type="button" class="bouton-flottant secondaire" id="scanner">Scanner</button>
      <button type="button" class="bouton-flottant" id="ajouter">+ Ajouter</button>
    </div>
  </section>`);
  conteneur.append(vue);

  const ul = vue.querySelector('.liste');

  function rafraichir() {
    const liste = filtrerIngredients(tous, etat);
    if (liste.length === 0) {
      ul.innerHTML = `<li class="vide">${
        tous.length === 0 ? 'Ta base est vide. Ajoute ton premier ingrédient !' : 'Aucun ingrédient trouvé.'
      }</li>`;
      return;
    }
    ul.innerHTML = liste
      .map(
        (ing) => `<li data-id="${ing.id}">
          <div class="infos">
            <strong>${echapper(ing.nom)}</strong>
            <span>${formaterNombre(ing.kcal)} kcal · ${formaterNombre(ing.proteines)} g prot. / 100 g</span>
          </div>
          <button type="button" class="etoile ${ing.favori ? 'actif' : ''}" aria-label="Favori">${ing.favori ? '★' : '☆'}</button>
        </li>`,
      )
      .join('');
  }

  vue.querySelector('.recherche').addEventListener('input', (e) => {
    etat.recherche = e.target.value;
    rafraichir();
  });

  vue.querySelector('.pastilles').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    etat.filtre = b.dataset.filtre;
    vue.querySelectorAll('.pastilles button').forEach((x) => x.classList.toggle('actif', x === b));
    rafraichir();
  });

  ul.addEventListener('click', async (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = Number(li.dataset.id);
    if (e.target.closest('.etoile')) {
      // L'étoile bascule le favori sans ouvrir la fiche.
      const favori = await basculerFavori(id);
      tous.find((i) => i.id === id).favori = favori;
      rafraichir();
      return;
    }
    ouvrirFiche(conteneur, id);
  });

  vue.querySelector('#ajouter').addEventListener('click', () => ouvrirFiche(conteneur, null));
  vue.querySelector('#scanner').addEventListener('click', () => ouvrirScan(conteneur));

  rafraichir();
}

// ======================= Fiche (ajout / modification) =======================

/**
 * Fiche d'un ingrédient.
 * - id : modifier un ingrédient existant ;
 * - sinon nouvel ingrédient, éventuellement pré-rempli (options.initial, ex. depuis Open Food Facts) ;
 * - options.message : texte affiché sous le titre (ex. « Produit inconnu… »).
 */
export async function ouvrirFiche(conteneur, id, { initial = {}, message = '' } = {}) {
  // Nouvel ingrédient : source « manuel » par défaut. Modification : on part de la fiche existante.
  const ing = id
    ? await chargerIngredient(id)
    : { source: 'manuel', favori: false, exclu: false, ...initial };
  const nouveau = !id;
  const titre = !nouveau ? 'Modifier' : ing.source === 'off' ? 'Produit trouvé' : 'Nouvel ingrédient';

  conteneur.innerHTML = '';
  window.scrollTo(0, 0);

  const vue = html(`<section>
    <button type="button" class="retour">← Retour</button>
    <h1>${titre}</h1>
    ${message ? `<p class="info">${echapper(message)}</p>` : ''}
    <form class="formulaire" autocomplete="off" novalidate>
      <label for="nom">Nom</label>
      <input id="nom" name="nom" type="text" value="${echapper(ing.nom)}" placeholder="ex. Riz basmati" />

      <label>Catégorie</label>
      <div class="choix choix-multi">
        ${CATEGORIES.map(([v, l]) => `<button type="button" data-valeur="${v}" class="${v === ing.categorie ? 'actif' : ''}">${l}</button>`).join('')}
      </div>

      <h2>Pour 100 g</h2>
      ${CHAMPS.map(([cle, libelle, obligatoire]) => `
        <div class="ligne">
          <label for="${cle}">${libelle}${obligatoire ? '' : ' <small>(facultatif)</small>'}</label>
          <input id="${cle}" name="${cle}" type="text" inputmode="decimal" value="${formaterNombre(ing[cle])}" />
        </div>`).join('')}
      <p class="avertissement" id="avertissement" hidden></p>

      <h2>Prix</h2>
      <div class="ligne">
        <label for="prixKg">Prix au kg (€) <small>(facultatif)</small></label>
        <input id="prixKg" name="prixKg" type="text" inputmode="decimal" value="${formaterNombre(ing.prixKg)}" />
      </div>

      <label for="codeBarres">Code-barres <small>(facultatif)</small></label>
      <input id="codeBarres" name="codeBarres" type="text" inputmode="numeric" value="${echapper(ing.codeBarres)}" />

      ${nouveau ? '' : `
        <label class="case">
          <input type="checkbox" id="exclu" ${ing.exclu ? 'checked' : ''} />
          Exclu (ne jamais me le proposer dans les menus)
        </label>`}

      <ul class="erreurs" id="erreurs" hidden></ul>
      <button type="submit" class="bouton principal">Enregistrer</button>
      ${nouveau ? '' : '<button type="button" class="bouton danger" id="supprimer">Supprimer</button>'}
    </form>
  </section>`);
  conteneur.append(vue);

  const form = vue.querySelector('form');
  const avertissement = vue.querySelector('#avertissement');
  const blocErreurs = vue.querySelector('#erreurs');

  // Lit le formulaire et renvoie un objet ingrédient (sans toucher à la base).
  function lireFormulaire() {
    const resultat = { ...ing, nom: form.nom.value.trim() };
    for (const [cle] of CHAMPS) resultat[cle] = lireNombre(form[cle].value);
    resultat.prixKg = lireNombre(form.prixKg.value);
    resultat.codeBarres = nettoyerCodeBarres(form.codeBarres.value) || undefined;
    if (!nouveau) resultat.exclu = vue.querySelector('#exclu').checked;
    return resultat;
  }

  // Avertissement de cohérence des kcal, mis à jour pendant la saisie (non bloquant).
  form.addEventListener('input', () => {
    const message = ecartCalories(lireFormulaire());
    avertissement.hidden = !message;
    avertissement.textContent = message ?? '';
  });

  vue.querySelector('.choix').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    ing.categorie = b.dataset.valeur;
    vue.querySelectorAll('.choix button').forEach((x) => x.classList.toggle('actif', x === b));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // empêche le rechargement de la page
    const resultat = lireFormulaire();
    const erreurs = validerIngredient(resultat);
    if (erreurs.length) {
      blocErreurs.innerHTML = erreurs.map((m) => `<li>${echapper(m)}</li>`).join('');
      blocErreurs.hidden = false;
      blocErreurs.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // On n'enregistre pas les champs facultatifs vides.
    for (const cle of Object.keys(resultat)) if (resultat[cle] === undefined) delete resultat[cle];
    await enregistrerIngredient(resultat);
    retourListe();
  });

  vue.querySelector('#supprimer')?.addEventListener('click', async () => {
    if (!confirm(`Supprimer « ${ing.nom} » définitivement ?`)) return;
    await supprimerIngredient(id);
    retourListe();
  });

  function retourListe() {
    conteneur.innerHTML = '';
    window.scrollTo(0, 0);
    afficherIngredients(conteneur);
  }
  vue.querySelector('.retour').addEventListener('click', retourListe);
}
