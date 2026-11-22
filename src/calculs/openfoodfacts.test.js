import { describe, it, expect } from 'vitest';
import { codeBarresValide, nettoyerCodeBarres, produitVersIngredient } from './openfoodfacts.js';

describe('clé de contrôle des codes-barres', () => {
  it('accepte des codes valides (EAN-13, EAN-8, UPC-A)', () => {
    expect(codeBarresValide('3017620422003')).toBe(true); // EAN-13
    expect(codeBarresValide('3274080005003')).toBe(true); // EAN-13
    expect(codeBarresValide('96385074')).toBe(true); // EAN-8
    expect(codeBarresValide('036000291452')).toBe(true); // UPC-A
  });
  it('rejette un chiffre mal lu', () => {
    expect(codeBarresValide('3017620422004')).toBe(false);
    expect(codeBarresValide('3017620482003')).toBe(false);
  });
  it('rejette les formats impossibles', () => {
    expect(codeBarresValide('')).toBe(false);
    expect(codeBarresValide('12345')).toBe(false);
    expect(codeBarresValide('30176204220a3')).toBe(false);
  });
  it('enlève les espaces tapés à la main', () => {
    expect(nettoyerCodeBarres(' 3 017620 422003 ')).toBe('3017620422003');
  });
});

// Réponses inspirées de vraies réponses de l'API (champs utiles seulement).
const reponseComplete = {
  status: 1,
  product: {
    product_name: 'Organic Basmati Rice',
    product_name_fr: 'Riz basmati bio',
    brands: 'Taureau Ailé, Riviana',
    nutriments: {
      'energy-kcal_100g': 352,
      'energy-kj_100g': 1489,
      proteins_100g: 8.2,
      carbohydrates_100g: 77.94,
      sugars_100g: 0.5,
      fat_100g: 0.8,
      fiber_100g: '1.6', // parfois envoyé en texte
    },
  },
};

describe('produit Open Food Facts → ingrédient', () => {
  it('produit complet', () => {
    expect(produitVersIngredient(reponseComplete, '3274080005003')).toEqual({
      nom: 'Riz basmati bio (Taureau Ailé)',
      source: 'off',
      codeBarres: '3274080005003',
      kcal: 352,
      proteines: 8.2,
      glucides: 77.9,
      lipides: 0.8,
      fibres: 1.6,
      sucres: 0.5,
      favori: false,
      exclu: false,
    });
  });
  it('convertit les kJ en kcal si les kcal manquent (1489 / 4,184 ≈ 356)', () => {
    const r = structuredClone(reponseComplete);
    delete r.product.nutriments['energy-kcal_100g'];
    expect(produitVersIngredient(r, '1').kcal).toBe(356);
  });
  it('ne répète pas la marque si elle est déjà dans le nom', () => {
    const r = { status: 1, product: { product_name: 'Nutella', brands: 'Nutella,Ferrero', nutriments: {} } };
    expect(produitVersIngredient(r, '1').nom).toBe('Nutella');
  });
  it('valeurs manquantes laissées vides', () => {
    const r = { status: 1, product: { product_name: 'Mystère', nutriments: { proteins_100g: 3 } } };
    const ing = produitVersIngredient(r, '1');
    expect(ing.proteines).toBe(3);
    expect('kcal' in ing).toBe(false);
    expect('lipides' in ing).toBe(false);
  });
  it('nom par défaut si le produit n\'en a pas', () => {
    expect(produitVersIngredient({ status: 1, product: {} }, '1').nom).toBe('Produit sans nom');
  });
  it('produit inconnu → null', () => {
    expect(produitVersIngredient({ status: 0, status_verbose: 'product not found' }, '1')).toBeNull();
    expect(produitVersIngredient(null, '1')).toBeNull();
  });
});
