import { describe, it, expect } from 'vitest';
import {
  macrosPourQuantite,
  kcalTheoriques,
  ecartCalories,
  validerIngredient,
  normaliserTexte,
  filtrerIngredients,
} from './ingredients.js';

// Valeurs proches d'étiquettes réelles (pour 100 g).
const riz = { nom: 'Riz basmati', categorie: 'feculent', kcal: 350, proteines: 8, glucides: 78, lipides: 1 };
const poulet = { nom: 'Blanc de poulet', categorie: 'proteine', kcal: 110, proteines: 23, glucides: 0, lipides: 2 };

describe('macros pour une quantité', () => {
  it('150 g de riz = 1,5 × les valeurs pour 100 g', () => {
    const m = macrosPourQuantite(riz, 150);
    expect(m.kcal).toBeCloseTo(525);
    expect(m.proteines).toBeCloseTo(12);
    expect(m.glucides).toBeCloseTo(117);
    expect(m.lipides).toBeCloseTo(1.5);
  });
  it('0 g = 0', () => expect(macrosPourQuantite(poulet, 0).kcal).toBe(0));
});

describe('cohérence des calories', () => {
  it('riz : 4×8 + 4×78 + 9×1 = 353 kcal théoriques', () => {
    expect(kcalTheoriques(riz)).toBe(353);
  });
  it('pas d\'avertissement si les valeurs sont cohérentes', () => {
    expect(ecartCalories(riz)).toBeNull();
    expect(ecartCalories(poulet)).toBeNull();
  });
  it('avertit en cas de faute de frappe (3500 au lieu de 350)', () => {
    expect(ecartCalories({ ...riz, kcal: 3500 })).toMatch(/353/);
  });
  it('tolère les petits écarts sur les aliments peu caloriques', () => {
    // concombre : 12 kcal pour 6 théoriques → écart de 6 kcal seulement
    expect(ecartCalories({ kcal: 12, proteines: 0.6, glucides: 0.9, lipides: 0.1 })).toBeNull();
  });
});

describe('validation', () => {
  it('un ingrédient complet est valide', () => {
    expect(validerIngredient(riz)).toEqual([]);
  });
  it('nom, catégorie et valeurs obligatoires', () => {
    const erreurs = validerIngredient({ nom: ' ' });
    expect(erreurs).toContain('Le nom est obligatoire.');
    expect(erreurs).toContain('Choisis une catégorie.');
    expect(erreurs.filter((e) => e.startsWith('Valeur manquante'))).toHaveLength(4);
  });
  it('refuse les valeurs négatives et impossibles', () => {
    expect(validerIngredient({ ...riz, lipides: -1 })).toContain('Valeur négative : lipides.');
    expect(validerIngredient({ ...riz, proteines: 50, glucides: 60 }).join()).toMatch(/dépassent 100 g/);
    expect(validerIngredient({ ...riz, sucres: 90 }).join()).toMatch(/sucres/);
  });
  it('les valeurs optionnelles peuvent manquer', () => {
    expect(validerIngredient({ ...riz, fibres: undefined, prixKg: undefined })).toEqual([]);
  });
});

describe('recherche et filtres', () => {
  const liste = [
    riz,
    poulet,
    { nom: 'Pâtes complètes', categorie: 'feculent', favori: true },
    { nom: 'Brocoli', categorie: 'legume', exclu: true },
  ];
  const noms = (l) => l.map((i) => i.nom);

  it('ignore accents et majuscules', () => {
    expect(normaliserTexte('  Pâtes Complètes ')).toBe('pates completes');
    expect(noms(filtrerIngredients(liste, { recherche: 'PATE' }))).toEqual(['Pâtes complètes']);
  });
  it('tous les mots doivent correspondre', () => {
    expect(noms(filtrerIngredients(liste, { recherche: 'poulet blanc' }))).toEqual(['Blanc de poulet']);
  });
  it('trie par nom et cache les exclus', () => {
    expect(noms(filtrerIngredients(liste))).toEqual(['Blanc de poulet', 'Pâtes complètes', 'Riz basmati']);
  });
  it('filtres favoris, catégorie et exclus', () => {
    expect(noms(filtrerIngredients(liste, { filtre: 'favoris' }))).toEqual(['Pâtes complètes']);
    expect(noms(filtrerIngredients(liste, { filtre: 'feculent' }))).toEqual(['Pâtes complètes', 'Riz basmati']);
    expect(noms(filtrerIngredients(liste, { filtre: 'exclus' }))).toEqual(['Brocoli']);
  });
});
