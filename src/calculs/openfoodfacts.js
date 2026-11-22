// Codes-barres et conversion des réponses Open Food Facts en ingrédients.
// Aucun appel réseau ici (voir src/services/openfoodfacts.js) : uniquement des transformations testables.

/**
 * Vérifie la clé de contrôle d'un code EAN-13, EAN-8 ou UPC-A (12 chiffres).
 * Le dernier chiffre est calculé à partir des autres : en partant de la droite
 * (sans la clé), on multiplie les chiffres alternativement par 3 et par 1,
 * on additionne, et la clé est ce qu'il faut ajouter pour atteindre une dizaine.
 * Exemple : 3017620422003 → somme pondérée = 77 → clé = 80 − 77 = 3 ✓
 * Une caméra qui lit mal un chiffre donne presque toujours une clé fausse.
 */
export function codeBarresValide(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false;
  const chiffres = code.split('').map(Number);
  const cle = chiffres.pop();
  const somme = chiffres
    .reverse()
    .reduce((total, c, i) => total + c * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (somme % 10)) % 10 === cle;
}

/** Enlève les espaces qu'on peut taper en recopiant un code à la main. */
export function nettoyerCodeBarres(texte) {
  return String(texte ?? '').replace(/\s+/g, '');
}

const KJ_PAR_KCAL = 4.184;

// Arrondis : kcal à l'unité, grammes au dixième (comme sur les étiquettes).
const arrondiKcal = (v) => Math.round(v);
const arrondiGrammes = (v) => Math.round(v * 10) / 10;

/** Lit un nombre dans les nutriments OFF (parfois envoyés en texte). undefined si absent. */
function nombre(valeur) {
  if (valeur === undefined || valeur === null || valeur === '') return undefined;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Transforme la réponse de l'API Open Food Facts en ingrédient de la base.
 * Renvoie null si le produit n'existe pas.
 * Les valeurs manquantes restent vides : le formulaire demandera de les compléter.
 */
export function produitVersIngredient(reponse, code) {
  if (!reponse || reponse.status !== 1 || !reponse.product) return null;
  const p = reponse.product;
  const n = p.nutriments ?? {};

  // Nom : français d'abord, puis nom générique, puis nom générique en français.
  const nomProduit = (p.product_name_fr || p.product_name || p.generic_name_fr || p.generic_name || '').trim();
  const marque = (p.brands || '').split(',')[0].trim();
  let nom = nomProduit || 'Produit sans nom';
  if (marque && !nom.toLowerCase().includes(marque.toLowerCase())) nom += ` (${marque})`;

  // Énergie : en kcal si disponible, sinon conversion depuis les kJ.
  let kcal = nombre(n['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = nombre(n['energy-kj_100g']) ?? nombre(n.energy_100g); // energy_100g est en kJ
    if (kj !== undefined) kcal = kj / KJ_PAR_KCAL;
  }

  const ingredient = {
    nom,
    source: 'off',
    codeBarres: code,
    kcal: kcal === undefined ? undefined : arrondiKcal(kcal),
    proteines: nombre(n.proteins_100g),
    glucides: nombre(n.carbohydrates_100g),
    lipides: nombre(n.fat_100g),
    fibres: nombre(n.fiber_100g),
    sucres: nombre(n.sugars_100g),
    favori: false,
    exclu: false,
  };
  for (const cle of ['proteines', 'glucides', 'lipides', 'fibres', 'sucres']) {
    if (ingredient[cle] !== undefined) ingredient[cle] = arrondiGrammes(ingredient[cle]);
  }
  // On retire les champs vides pour garder une fiche propre.
  for (const cle of Object.keys(ingredient)) if (ingredient[cle] === undefined) delete ingredient[cle];
  return ingredient;
}
