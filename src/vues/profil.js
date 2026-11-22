import { chargerProfil, enregistrerProfil, chargerParametres } from '../db.js';
import { calculerObjectifs } from '../calculs/objectifs.js';
import { lireNombre, formaterNombre, html } from './outils.js';

const NIVEAUX = [
  ['sedentaire', 'Sédentaire (peu ou pas de sport)'],
  ['leger', 'Léger (1–3 séances / semaine)'],
  ['modere', 'Modéré (3–5 séances / semaine)'],
  ['actif', 'Actif (6–7 séances / semaine)'],
  ['tres_actif', 'Très actif (sport intense + travail physique)'],
];

// Champs numériques : [clé dans le profil, libellé, unité]
const CHAMPS_NUM = [
  ['age', 'Âge', 'ans'],
  ['tailleCm', 'Taille', 'cm'],
  ['poidsKg', 'Poids', 'kg'],
  ['repasParJour', 'Repas par jour', ''],
  ['budgetSemaine', 'Budget max / semaine', '€'],
];

// Groupe de gros boutons à choix unique (plus pratique qu'une liste au pouce).
function choix(cle, options, valeur) {
  return `<div class="choix" data-cle="${cle}">
    ${options
      .map(([v, l]) => `<button type="button" data-valeur="${v}" class="${v === valeur ? 'actif' : ''}">${l}</button>`)
      .join('')}
  </div>`;
}

export async function afficherProfil(conteneur) {
  const [profil, params] = await Promise.all([chargerProfil(), chargerParametres()]);

  const vue = html(`<section>
    <h1>Mon profil</h1>
    <div class="carte" id="objectifs"></div>
    <form class="formulaire" autocomplete="off">
      <label>Sexe</label>
      ${choix('sexe', [['homme', 'Homme'], ['femme', 'Femme']], profil.sexe)}
      ${CHAMPS_NUM.map(([cle, libelle, unite]) => `
        <label for="${cle}">${libelle}${unite ? ` (${unite})` : ''}</label>
        <input id="${cle}" name="${cle}" type="text" inputmode="decimal"
               value="${formaterNombre(profil[cle])}" />`).join('')}
      <label for="niveauActivite">Niveau d'activité</label>
      <select id="niveauActivite" name="niveauActivite">
        <option value="">— Choisir —</option>
        ${NIVEAUX.map(([v, l]) => `<option value="${v}" ${v === profil.niveauActivite ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <label>Objectif</label>
      ${choix('objectif', [['seche', 'Sèche'], ['maintien', 'Maintien'], ['prise_de_masse', 'Prise de masse']], profil.objectif)}
    </form>
    <p class="note" id="statut"></p>
  </section>`);
  conteneur.append(vue);

  const blocObjectifs = vue.querySelector('#objectifs');
  const statut = vue.querySelector('#statut');

  // Recalcule et affiche les objectifs à partir du profil en cours.
  function majObjectifs() {
    const o = calculerObjectifs(profil, params);
    if (!o) {
      blocObjectifs.innerHTML = '<p class="vide">Remplis ton profil pour voir tes objectifs.</p>';
      return;
    }
    blocObjectifs.innerHTML = `
      <div class="kcal"><strong>${o.kcal}</strong> kcal / jour</div>
      <div class="macros">
        <div><strong>${o.proteines} g</strong><span>Protéines</span></div>
        <div><strong>${o.glucides} g</strong><span>Glucides</span></div>
        <div><strong>${o.lipides} g</strong><span>Lipides</span></div>
      </div>
      <p class="detail">Métabolisme de base : ${o.mb} kcal · Dépense journalière : ${o.dj} kcal</p>`;
  }

  // Enregistre à chaque modification : pas de bouton « Enregistrer » à oublier.
  async function sauver() {
    await enregistrerProfil(profil);
    majObjectifs();
    statut.textContent = 'Enregistré ✓';
  }

  vue.querySelectorAll('input').forEach((input) =>
    input.addEventListener('input', () => {
      profil[input.name] = lireNombre(input.value);
      sauver();
    }),
  );
  vue.querySelector('select').addEventListener('change', (e) => {
    profil.niveauActivite = e.target.value || undefined;
    sauver();
  });
  vue.querySelectorAll('.choix').forEach((groupe) =>
    groupe.addEventListener('click', (e) => {
      const bouton = e.target.closest('button');
      if (!bouton) return;
      groupe.querySelectorAll('button').forEach((b) => b.classList.toggle('actif', b === bouton));
      profil[groupe.dataset.cle] = bouton.dataset.valeur;
      sauver();
    }),
  );

  majObjectifs();
}
