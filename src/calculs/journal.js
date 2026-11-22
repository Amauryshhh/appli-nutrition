// Calculs du suivi du jour : totaux des repas, du jour, reste à manger, dates.
import { macrosPourQuantite } from './ingredients.js';

export const TYPES_REPAS = [
  ['petit_dej', 'Petit-déjeuner'],
  ['dejeuner', 'Déjeuner'],
  ['diner', 'Dîner'],
  ['collation', 'Collation'],
];

export const MACROS = ['kcal', 'proteines', 'glucides', 'lipides'];

const zero = () => ({ kcal: 0, proteines: 0, glucides: 0, lipides: 0 });

function additionner(a, b) {
  const r = zero();
  for (const m of MACROS) r[m] = a[m] + (b[m] ?? 0);
  return r;
}

/**
 * Ligne de repas à partir d'un ingrédient de la base.
 * On garde une COPIE du nom et des valeurs pour 100 g : si l'ingrédient est modifié
 * ou supprimé plus tard, l'historique des repas reste exact.
 */
export function alimentDepuisIngredient(ing, grammes) {
  return {
    ingredientId: ing.id,
    nom: ing.nom,
    grammes,
    valeurs: { kcal: ing.kcal, proteines: ing.proteines, glucides: ing.glucides, lipides: ing.lipides },
  };
}

/**
 * Total d'un repas.
 * - saisie rapide : les valeurs saisies directement ;
 * - sinon : somme des ingrédients (valeurs pour 100 g × grammes / 100).
 */
export function totalRepas(repas) {
  if (repas.saisieRapide) return additionner(zero(), repas.saisieRapide);
  return (repas.aliments ?? []).reduce(
    (total, a) => additionner(total, macrosPourQuantite(a.valeurs, a.grammes ?? 0)),
    zero(),
  );
}

/** Total du jour : seuls les repas VALIDÉS comptent (pas les « prévus » ni les « sautés »). */
export function totalJour(listeRepas) {
  return listeRepas
    .filter((r) => r.statut === 'valide')
    .reduce((total, r) => additionner(total, totalRepas(r)), zero());
}

/** Objectifs − déjà mangé. Une valeur négative signifie que l'objectif est dépassé. */
export function resteAManger(objectifs, mange) {
  const r = zero();
  for (const m of MACROS) r[m] = objectifs[m] - mange[m];
  return r;
}

/** Part de l'objectif atteinte, entre 0 et 1 (pour la largeur des barres). */
export function progression(valeur, objectif) {
  if (!objectif || objectif <= 0) return 0;
  return Math.min(1, Math.max(0, valeur / objectif));
}

/** Vérifie un repas avant enregistrement. Renvoie la liste des erreurs. */
export function validerRepas(repas) {
  const erreurs = [];
  if (!TYPES_REPAS.some(([t]) => t === repas.typeRepas)) erreurs.push('Choisis le type de repas.');
  if (repas.saisieRapide) {
    const s = repas.saisieRapide;
    if (typeof s.kcal !== 'number') erreurs.push('Indique au moins les kcal.');
    for (const m of MACROS) if (s[m] < 0) erreurs.push('Les valeurs ne peuvent pas être négatives.');
  } else {
    const aliments = repas.aliments ?? [];
    if (aliments.length === 0) erreurs.push('Ajoute au moins un ingrédient.');
    if (aliments.some((a) => !(a.grammes > 0))) erreurs.push('Indique une quantité en grammes pour chaque ingrédient.');
  }
  return [...new Set(erreurs)];
}

// ---- Dates ----
// Les dates sont stockées en texte « AAAA-MM-JJ », en HEURE LOCALE.
// Piège évité : date.toISOString() donne la date en heure UTC ; à Paris, un repas
// noté entre minuit et 1 h (2 h en été) serait rangé à la veille.

const deuxChiffres = (n) => String(n).padStart(2, '0');

export function dateLocale(date = new Date()) {
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
}

/** Convertit « AAAA-MM-JJ » en objet Date (à midi, heure locale). */
export function versDate(texte) {
  const [a, m, j] = texte.split('-').map(Number);
  return new Date(a, m - 1, j, 12);
}

/** Ajoute (ou retire) des jours à une date « AAAA-MM-JJ ». Gère les changements de mois et d'année. */
export function decalerJour(texte, jours) {
  const d = versDate(texte);
  d.setDate(d.getDate() + jours);
  return dateLocale(d);
}
