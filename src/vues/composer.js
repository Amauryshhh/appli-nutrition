import {
  listerIngredients,
  chargerRepas,
  enregistrerRepas,
  supprimerRepas,
  repasDuJour,
  chargerObjectifs,
} from '../db.js';
import { filtrerIngredients, macrosPourQuantite } from '../calculs/ingredients.js';
import {
  TYPES_REPAS,
  alimentDepuisIngredient,
  totalRepas,
  totalJour,
  resteAManger,
  validerRepas,
} from '../calculs/journal.js';
import { lireNombre, formaterNombre, echapper, html, formaterReste, formaterTotal } from './outils.js';

const GRAMMES_PAR_DEFAUT = 100;
const NB_RESULTATS = 8; // résultats de recherche affichés au maximum

/**
 * Écran de composition d'un repas.
 * options : { id } pour modifier un repas existant, ou { date, typeRepas } pour en créer un.
 * retour : fonction appelée pour revenir à l'écran précédent.
 */
export async function ouvrirComposition(conteneur, options, retour) {
  const nouveau = !options.id;
  const repas = nouveau
    ? { date: options.date, typeRepas: options.typeRepas, aliments: [], statut: 'valide', origine: 'manuel' }
    : await chargerRepas(options.id);
  repas.aliments ??= [];

  const [ingredients, objectifs, repasJour] = await Promise.all([
    listerIngredients(),
    chargerObjectifs(),
    repasDuJour(repas.date),
  ]);
  // Ce qui a déjà été mangé ce jour-là, SANS le repas en cours de modification.
  const dejaMange = totalJour(repasJour.filter((r) => r.id !== repas.id));

  // Mode saisie rapide : on garde aussi les ingrédients en mémoire pour pouvoir revenir en arrière.
  let rapide = Boolean(repas.saisieRapide);
  const saisieRapide = { nom: '', ...repas.saisieRapide };

  conteneur.innerHTML = '';
  window.scrollTo(0, 0);

  const vue = html(`<section>
    <button type="button" class="retour">← Retour</button>
    <h1>${nouveau ? 'Nouveau repas' : 'Modifier le repas'}</h1>

    <div class="choix choix-multi deux-colonnes" id="types">
      ${TYPES_REPAS.map(([v, l]) => `<button type="button" data-valeur="${v}" class="${v === repas.typeRepas ? 'actif' : ''}">${l}</button>`).join('')}
    </div>

    <label class="case">
      <input type="checkbox" id="rapide" ${rapide ? 'checked' : ''} />
      Saisie rapide (sans ingrédients)
    </label>

    <div id="mode-ingredients">
      <ul class="lignes-repas" id="lignes"></ul>
      <input type="search" class="recherche" id="recherche" placeholder="Ajouter un ingrédient…" />
      <ul class="liste resultats" id="resultats"></ul>
    </div>

    <div id="mode-rapide" class="formulaire">
      <label for="r-nom">Description</label>
      <input id="r-nom" type="text" placeholder="ex. Burger au resto" value="${echapper(saisieRapide.nom)}" />
      ${[['kcal', 'Énergie (kcal)'], ['proteines', 'Protéines (g)'], ['glucides', 'Glucides (g)'], ['lipides', 'Lipides (g)']]
        .map(([cle, libelle]) => `
        <div class="ligne">
          <label for="r-${cle}">${libelle}</label>
          <input id="r-${cle}" data-cle="${cle}" type="text" inputmode="decimal" value="${formaterNombre(saisieRapide[cle])}" />
        </div>`).join('')}
    </div>

    <div class="carte totaux">
      <div><strong>Ce repas :</strong> <span id="total-repas"></span></div>
      <div id="bloc-reste"><strong>Il restera :</strong> <span id="reste"></span></div>
    </div>

    <ul class="erreurs" id="erreurs" hidden></ul>
    <button type="button" class="bouton principal" id="enregistrer">Enregistrer</button>
    ${nouveau ? '' : '<button type="button" class="bouton danger" id="supprimer">Supprimer ce repas</button>'}
  </section>`);
  conteneur.append(vue);

  const $ = (s) => vue.querySelector(s);
  const ulLignes = $('#lignes');
  const ulResultats = $('#resultats');
  const champRecherche = $('#recherche');

  // ---- Repas tel qu'il serait enregistré maintenant ----
  function repasCourant() {
    const r = { ...repas };
    if (rapide) {
      r.saisieRapide = { ...saisieRapide };
      delete r.aliments;
    } else {
      delete r.saisieRapide;
    }
    return r;
  }

  // ---- Totaux (mis à jour à chaque frappe, sans redessiner les champs) ----
  function majTotaux() {
    const total = totalRepas(repasCourant());
    $('#total-repas').textContent = formaterTotal(total);
    if (objectifs) {
      const apres = { ...dejaMange };
      for (const m of Object.keys(apres)) apres[m] += total[m];
      $('#reste').innerHTML = formaterReste(resteAManger(objectifs, apres));
    } else {
      $('#bloc-reste').hidden = true; // pas de profil = pas d'objectifs
    }
    // kcal de chaque ligne
    ulLignes.querySelectorAll('li').forEach((li, i) => {
      const a = repas.aliments[i];
      li.querySelector('.kcal-ligne').textContent =
        `${Math.round(macrosPourQuantite(a.valeurs, a.grammes ?? 0).kcal)} kcal`;
    });
  }

  // ---- Lignes d'ingrédients du repas ----
  function dessinerLignes() {
    ulLignes.innerHTML = repas.aliments
      .map(
        (a, i) => `<li data-index="${i}">
          <span class="nom">${echapper(a.nom)}</span>
          <input type="text" inputmode="decimal" class="grammes" value="${formaterNombre(a.grammes)}" aria-label="Grammes" />
          <span class="unite">g</span>
          <span class="kcal-ligne"></span>
          <button type="button" class="retirer" aria-label="Retirer">✕</button>
        </li>`,
      )
      .join('');
    majTotaux();
  }

  ulLignes.addEventListener('input', (e) => {
    if (!e.target.classList.contains('grammes')) return;
    const i = Number(e.target.closest('li').dataset.index);
    repas.aliments[i].grammes = lireNombre(e.target.value);
    majTotaux();
  });
  ulLignes.addEventListener('click', (e) => {
    if (!e.target.closest('.retirer')) return;
    repas.aliments.splice(Number(e.target.closest('li').dataset.index), 1);
    dessinerLignes();
  });

  // ---- Recherche d'ingrédients à ajouter ----
  function dessinerResultats() {
    const texte = champRecherche.value.trim();
    if (!texte) {
      ulResultats.innerHTML = ingredients.length
        ? ''
        : '<li class="vide">Ta base est vide : ajoute d\'abord des ingrédients dans l\'onglet Ingrédients.</li>';
      return;
    }
    const trouves = filtrerIngredients(ingredients, { recherche: texte }).slice(0, NB_RESULTATS);
    ulResultats.innerHTML = trouves.length
      ? trouves
          .map((ing) => `<li data-id="${ing.id}">
            <div class="infos"><strong>${echapper(ing.nom)}</strong>
            <span>${formaterNombre(ing.kcal)} kcal / 100 g</span></div>
            <span class="plus">+</span></li>`)
          .join('')
      : '<li class="vide">Aucun ingrédient trouvé.</li>';
  }
  champRecherche.addEventListener('input', dessinerResultats);

  ulResultats.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const ing = ingredients.find((x) => x.id === Number(li.dataset.id));
    repas.aliments.push(alimentDepuisIngredient(ing, GRAMMES_PAR_DEFAUT));
    champRecherche.value = '';
    dessinerResultats();
    dessinerLignes();
    // Sélectionne les grammes de la nouvelle ligne : on tape directement la quantité.
    const champ = ulLignes.querySelector('li:last-child .grammes');
    champ.focus();
    champ.select();
  });

  // ---- Saisie rapide ----
  $('#r-nom').addEventListener('input', (e) => (saisieRapide.nom = e.target.value));
  $('#mode-rapide').addEventListener('input', (e) => {
    if (!e.target.dataset.cle) return;
    saisieRapide[e.target.dataset.cle] = lireNombre(e.target.value);
    majTotaux();
  });

  function majMode() {
    $('#mode-ingredients').hidden = rapide;
    $('#mode-rapide').hidden = !rapide;
    majTotaux();
  }
  $('#rapide').addEventListener('change', (e) => {
    rapide = e.target.checked;
    majMode();
  });

  // ---- Type de repas ----
  $('#types').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    repas.typeRepas = b.dataset.valeur;
    vue.querySelectorAll('#types button').forEach((x) => x.classList.toggle('actif', x === b));
  });

  // ---- Enregistrer / supprimer ----
  $('#enregistrer').addEventListener('click', async () => {
    const r = repasCourant();
    if (r.saisieRapide) {
      r.saisieRapide.nom = r.saisieRapide.nom.trim() || 'Saisie rapide';
      for (const k of Object.keys(r.saisieRapide)) if (r.saisieRapide[k] === undefined) delete r.saisieRapide[k];
    }
    const erreurs = validerRepas(r);
    if (erreurs.length) {
      $('#erreurs').innerHTML = erreurs.map((m) => `<li>${echapper(m)}</li>`).join('');
      $('#erreurs').hidden = false;
      $('#erreurs').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    await enregistrerRepas(r);
    retour();
  });

  $('#supprimer')?.addEventListener('click', async () => {
    if (!confirm('Supprimer ce repas ?')) return;
    await supprimerRepas(repas.id);
    retour();
  });

  $('.retour').addEventListener('click', retour);

  dessinerLignes();
  dessinerResultats();
  majMode();
}
