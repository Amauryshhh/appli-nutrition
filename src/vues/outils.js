// Petites fonctions partagées par les écrans.

/**
 * Lit un nombre tapé par l'utilisateur. Le clavier français de l'iPhone met une virgule
 * (« 72,5 ») : on la remplace par un point. Renvoie undefined si le champ est vide ou invalide.
 */
export function lireNombre(texte) {
  const n = parseFloat(String(texte).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Affiche un nombre à la française (virgule décimale). */
export function formaterNombre(n) {
  return n === undefined || n === null ? '' : String(n).replace('.', ',');
}

/** Crée un élément HTML à partir d'un morceau de HTML. */
export function html(chaine) {
  const t = document.createElement('template');
  t.innerHTML = chaine.trim();
  return t.content.firstElementChild;
}
