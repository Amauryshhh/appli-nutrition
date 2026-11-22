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

/**
 * Protège un texte saisi par l'utilisateur avant de l'insérer dans du HTML :
 * « < » devient « &lt; », etc. Sinon un nom comme « <b>Riz » casserait l'affichage.
 */
export function echapper(texte) {
  return String(texte ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

/** Crée un élément HTML à partir d'un morceau de HTML. */
export function html(chaine) {
  const t = document.createElement('template');
  t.innerHTML = chaine.trim();
  return t.content.firstElementChild;
}

/**
 * Texte « reste à manger » : « 850 kcal · 40 g P · 95 g G · 20 g L ».
 * Une valeur négative (objectif dépassé) s'affiche « 120 kcal en trop », en rouge.
 */
export function formaterReste(reste) {
  const morceau = (valeur, unite) => {
    const n = Math.round(valeur);
    return n < 0
      ? `<span class="depasse">${-n}&nbsp;${unite} en&nbsp;trop</span>`
      : `<span>${n}&nbsp;${unite}</span>`;
  };
  return [
    morceau(reste.kcal, 'kcal'),
    morceau(reste.proteines, 'g&nbsp;P'),
    morceau(reste.glucides, 'g&nbsp;G'),
    morceau(reste.lipides, 'g&nbsp;L'),
  ].join(' · ');
}

/** Résumé court d'un total : « 515 kcal · P 43 · G 78 · L 4 ». */
export function formaterTotal(t) {
  return `${Math.round(t.kcal)} kcal · P ${Math.round(t.proteines)} · G ${Math.round(t.glucides)} · L ${Math.round(t.lipides)}`;
}

// ---- Nettoyage quand on quitte un écran ----
// Un écran qui utilise une ressource (ex. la caméra) enregistre ici de quoi la libérer.
// main.js appelle quitterVue() à chaque changement d'onglet.
let nettoyage = null;

export function surDepart(fonction) {
  nettoyage = fonction;
}

export function quitterVue() {
  const f = nettoyage;
  nettoyage = null;
  f?.();
}
