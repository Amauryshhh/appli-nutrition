// Calculs et règles sur les ingrédients. Toutes les valeurs nutritionnelles sont « pour 100 g ».
import { KCAL_PAR_GRAMME } from './objectifs.js';

export const CATEGORIES = [
  ['proteine', 'Protéine'],
  ['feculent', 'Féculent'],
  ['legume', 'Légume'],
  ['sauce', 'Sauce'],
  ['autre', 'Autre'],
];

// Nutriments obligatoires et optionnels (pour 100 g).
export const NUTRIMENTS_OBLIGATOIRES = ['kcal', 'proteines', 'glucides', 'lipides'];
export const NUTRIMENTS_OPTIONNELS = ['fibres', 'sucres'];

// Noms affichés dans les messages d'erreur.
const LIBELLES = {
  kcal: 'énergie (kcal)',
  proteines: 'protéines',
  glucides: 'glucides',
  lipides: 'lipides',
  fibres: 'fibres',
  sucres: 'sucres',
  prixKg: 'prix au kg',
};

/**
 * Valeurs nutritionnelles pour une quantité donnée.
 * Règle de trois : valeur pour 100 g × grammes / 100.
 */
export function macrosPourQuantite(ingredient, grammes) {
  const facteur = grammes / 100;
  return {
    kcal: (ingredient.kcal ?? 0) * facteur,
    proteines: (ingredient.proteines ?? 0) * facteur,
    glucides: (ingredient.glucides ?? 0) * facteur,
    lipides: (ingredient.lipides ?? 0) * facteur,
  };
}

/** Calories « théoriques » d'après les macros : 4 × P + 4 × G + 9 × L. */
export function kcalTheoriques(ing) {
  return (
    ing.proteines * KCAL_PAR_GRAMME.proteines +
    ing.glucides * KCAL_PAR_GRAMME.glucides +
    ing.lipides * KCAL_PAR_GRAMME.lipides
  );
}

/**
 * Contrôle de cohérence entre les kcal saisies et les macros saisies.
 * Renvoie un message d'avertissement, ou null si c'est cohérent.
 * Tolérance large (20 % ET 20 kcal) : les fibres, l'alcool et les arrondis
 * des étiquettes créent toujours un petit écart.
 */
export function ecartCalories(ing) {
  if (NUTRIMENTS_OBLIGATOIRES.some((n) => typeof ing[n] !== 'number')) return null;
  const theorique = kcalTheoriques(ing);
  const ecart = Math.abs(ing.kcal - theorique);
  const reference = Math.max(ing.kcal, theorique, 1);
  if (ecart > 20 && ecart / reference > 0.2) {
    return `Les macros donnent environ ${Math.round(theorique)} kcal, pas ${ing.kcal}. Vérifie ta saisie.`;
  }
  return null;
}

/** Vérifie un ingrédient avant enregistrement. Renvoie la liste des erreurs (vide si tout va bien). */
export function validerIngredient(ing) {
  const erreurs = [];
  if (!ing.nom || !ing.nom.trim()) erreurs.push('Le nom est obligatoire.');
  if (!CATEGORIES.some(([c]) => c === ing.categorie)) erreurs.push('Choisis une catégorie.');
  for (const n of NUTRIMENTS_OBLIGATOIRES) {
    if (typeof ing[n] !== 'number') erreurs.push(`Valeur manquante : ${LIBELLES[n]}.`);
  }
  for (const n of [...NUTRIMENTS_OBLIGATOIRES, ...NUTRIMENTS_OPTIONNELS, 'prixKg']) {
    if (typeof ing[n] === 'number' && ing[n] < 0) erreurs.push(`Valeur négative : ${LIBELLES[n]}.`);
  }
  if (ing.kcal > 900) erreurs.push('Plus de 900 kcal pour 100 g, c\'est impossible.');
  const totalMacros = (ing.proteines ?? 0) + (ing.glucides ?? 0) + (ing.lipides ?? 0);
  if (totalMacros > 100) erreurs.push('Protéines + glucides + lipides dépassent 100 g pour 100 g.');
  if (typeof ing.sucres === 'number' && ing.sucres > (ing.glucides ?? 0)) {
    erreurs.push('Les sucres ne peuvent pas dépasser les glucides.');
  }
  return erreurs;
}

/** Texte en minuscules et sans accents, pour une recherche tolérante (« pate » trouve « Pâtes »). */
export function normaliserTexte(texte) {
  return String(texte ?? '')
    .normalize('NFD') // sépare la lettre de son accent : « â » → « a » + « ̂ »
    .replace(/[̀-ͯ]/g, '') // supprime les accents
    .toLowerCase()
    .trim();
}

/**
 * Filtre et trie la liste affichée.
 * filtre : 'tous' | 'favoris' | 'exclus' | une catégorie. Les exclus n'apparaissent que dans le filtre 'exclus'.
 */
export function filtrerIngredients(liste, { recherche = '', filtre = 'tous' } = {}) {
  const mots = normaliserTexte(recherche).split(/\s+/).filter(Boolean);
  return liste
    .filter((ing) => (filtre === 'exclus' ? ing.exclu : !ing.exclu))
    .filter((ing) => {
      if (filtre === 'tous' || filtre === 'exclus') return true;
      if (filtre === 'favoris') return ing.favori;
      return ing.categorie === filtre;
    })
    .filter((ing) => {
      const nom = normaliserTexte(ing.nom);
      return mots.every((m) => nom.includes(m)); // tous les mots tapés doivent être dans le nom
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
