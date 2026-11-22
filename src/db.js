import Dexie from 'dexie';
import { PARAMETRES_DEFAUT } from './calculs/objectifs.js';

// Base IndexedDB stockée sur le téléphone.
export const db = new Dexie('nutrition');

// Chaque fois qu'on ajoute une table, on crée une nouvelle version.
// Dexie migre tout seul la base du téléphone, sans effacer les données existantes.
db.version(1).stores({
  profil: 'id', // un seul profil, id = 1
});
db.version(2).stores({
  profil: 'id',
  parametres: 'id', // un seul jeu de coefficients, id = 1
});
db.version(3).stores({
  profil: 'id',
  parametres: 'id',
  // « ++id » : numéro attribué automatiquement. Les autres champs listés sont indexés
  // (recherche rapide). Les champs non listés (kcal, favori…) sont quand même enregistrés.
  ingredients: '++id, nom, categorie, codeBarres',
});
db.version(4).stores({
  profil: 'id',
  parametres: 'id',
  ingredients: '++id, nom, categorie, codeBarres',
  // Une entrée par repas. Indexé par date (« AAAA-MM-JJ ») pour charger un jour rapidement.
  journal: '++id, date',
});

const ID_UNIQUE = 1;

export async function chargerProfil() {
  return (await db.profil.get(ID_UNIQUE)) ?? {};
}

export async function enregistrerProfil(profil) {
  await db.profil.put({ ...profil, id: ID_UNIQUE });
}

/**
 * Renvoie les coefficients enregistrés, complétés par les valeurs par défaut.
 * (Utile si on ajoute un coefficient plus tard : il prendra sa valeur par défaut.)
 */
export async function chargerParametres() {
  const enregistres = (await db.parametres.get(ID_UNIQUE)) ?? {};
  return {
    facteursActivite: { ...PARAMETRES_DEFAUT.facteursActivite, ...enregistres.facteursActivite },
    multiplicateursObjectif: {
      ...PARAMETRES_DEFAUT.multiplicateursObjectif,
      ...enregistres.multiplicateursObjectif,
    },
    proteinesParKg: enregistres.proteinesParKg ?? PARAMETRES_DEFAUT.proteinesParKg,
    lipidesParKg: enregistres.lipidesParKg ?? PARAMETRES_DEFAUT.lipidesParKg,
  };
}

export async function enregistrerParametres(params) {
  await db.parametres.put({ ...params, id: ID_UNIQUE });
}

export async function reinitialiserParametres() {
  await db.parametres.delete(ID_UNIQUE);
}

// ---- Ingrédients ----

export function listerIngredients() {
  return db.ingredients.toArray();
}

export function chargerIngredient(id) {
  return db.ingredients.get(id);
}

/** Ajoute (sans id) ou remplace (avec id) un ingrédient. Renvoie son id. */
export function enregistrerIngredient(ingredient) {
  return db.ingredients.put(ingredient);
}

export function supprimerIngredient(id) {
  return db.ingredients.delete(id);
}

export async function basculerFavori(id) {
  const ing = await db.ingredients.get(id);
  await db.ingredients.update(id, { favori: !ing.favori });
  return !ing.favori;
}

// ---- Journal (repas) ----

/** Tous les repas d'un jour (« AAAA-MM-JJ »). */
export function repasDuJour(date) {
  return db.journal.where('date').equals(date).toArray();
}

export function chargerRepas(id) {
  return db.journal.get(id);
}

/** Ajoute (sans id) ou remplace (avec id) un repas. Renvoie son id. */
export function enregistrerRepas(repas) {
  return db.journal.put(repas);
}

export function supprimerRepas(id) {
  return db.journal.delete(id);
}
