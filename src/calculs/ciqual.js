// Table CIQUAL (Anses) : choix de la catégorie, conversion en ingrédient, recherche.
// Source des données : Anses, Table de composition nutritionnelle des aliments Ciqual 2020
// (Licence Ouverte : réutilisation libre en citant la source).
import { normaliserTexte } from './ingredients.js';

export const SOURCE_CIQUAL = 'Anses, table de composition nutritionnelle des aliments Ciqual 2020';

/**
 * Catégorie proposée d'après le groupe et le sous-groupe CIQUAL (comparaison sans accents).
 * L'ordre des règles compte : la première qui correspond gagne.
 * Les fruits vont dans « autre » : le générateur de menus assemblera protéine + féculent + légume,
 * et une banane n'a pas sa place comme « légume » d'un plat.
 */
const REGLES = [
  { si: ['pommes de terre', 'legumineuses'], categorie: 'feculent' },
  { si: ['fruits a coque', 'oleagineux'], categorie: 'autre' },
  { si: ['legumes'], categorie: 'legume' },
  // Règle explicite : sinon « fruits » retomberait sur le nom du groupe
  // (« fruits, légumes, légumineuses… ») et serait classé féculent.
  { si: ['fruits'], categorie: 'autre' },
  { si: ['viandes', 'poissons', 'oeufs', 'charcuteries', 'mollusques', 'crustaces'], categorie: 'proteine' },
  { si: ['sauces', 'condiments', 'matieres grasses', 'epices', 'herbes'], categorie: 'sauce' },
  { si: ['pates, riz', 'cereales', 'pains', 'produits cerealiers'], categorie: 'feculent' },
];

export function categorieDepuisGroupe(groupe, sousGroupe) {
  // On regarde le sous-groupe d'abord (plus précis), puis le groupe.
  for (const texte of [sousGroupe, groupe]) {
    const t = normaliserTexte(texte);
    if (!t) continue;
    for (const regle of REGLES) {
      if (regle.si.some((mot) => t.includes(mot))) return regle.categorie;
    }
  }
  return 'autre';
}

// Format compact de public/ciqual.json (produit par scripts/convertir-ciqual.mjs) :
// {
//   groupes: [[nomGroupe, nomSousGroupe, categorie], ...],
//   aliments: [[code, nom, indexGroupe, kcal, proteines, glucides, lipides, sucres, fibres], ...]
// }
// Une valeur inconnue vaut null.
const I = { code: 0, nom: 1, groupe: 2, kcal: 3, proteines: 4, glucides: 5, lipides: 6, sucres: 7, fibres: 8 };

/** Ligne de la table → objet lisible. */
export function lireAliment(ligne, groupes) {
  const [nomGroupe, nomSousGroupe, categorie] = groupes[ligne[I.groupe]] ?? ['', '', 'autre'];
  const aliment = { code: ligne[I.code], nom: ligne[I.nom], groupe: nomSousGroupe || nomGroupe, categorie };
  for (const cle of ['kcal', 'proteines', 'glucides', 'lipides', 'sucres', 'fibres']) {
    if (ligne[I[cle]] !== null && ligne[I[cle]] !== undefined) aliment[cle] = ligne[I[cle]];
  }
  return aliment;
}

/** Aliment CIQUAL → ingrédient prêt à pré-remplir la fiche. */
export function alimentVersIngredient(aliment) {
  const ing = {
    nom: aliment.nom,
    source: 'ciqual',
    codeCiqual: aliment.code,
    categorie: aliment.categorie,
    favori: false,
    exclu: false,
  };
  for (const cle of ['kcal', 'proteines', 'glucides', 'lipides', 'sucres', 'fibres']) {
    if (aliment[cle] !== undefined) ing[cle] = aliment[cle];
  }
  return ing;
}

/**
 * Recherche dans la table : tous les mots tapés doivent être dans le nom (sans accents).
 * Tri : les noms qui COMMENCENT par le premier mot d'abord (« pomme » → « Pomme, crue »
 * avant « Compote de pomme »), puis les noms les plus courts (souvent l'aliment brut).
 * table : { groupes, aliments } ; renvoie au plus « max » aliments lisibles.
 */
export function rechercherCiqual(table, texte, max = 10) {
  const mots = normaliserTexte(texte).split(/\s+/).filter(Boolean);
  if (!table || mots.length === 0) return [];
  const resultats = [];
  for (const ligne of table.aliments) {
    const nom = normaliserTexte(ligne[I.nom]);
    if (mots.every((m) => nom.includes(m))) {
      resultats.push({ ligne, debut: nom.startsWith(mots[0]) ? 0 : 1, longueur: nom.length });
    }
  }
  resultats.sort((a, b) => a.debut - b.debut || a.longueur - b.longueur);
  return resultats.slice(0, max).map((r) => lireAliment(r.ligne, table.groupes));
}
