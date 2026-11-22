import { describe, it, expect } from 'vitest';
import { categorieDepuisGroupe, lireAliment, alimentVersIngredient, rechercherCiqual } from './ciqual.js';

describe('catégorie d\'après le groupe CIQUAL', () => {
  const cas = [
    ['viandes, œufs, poissons et assimilés', 'viandes cuites', 'proteine'],
    ['viandes, œufs, poissons et assimilés', 'œufs', 'proteine'],
    ['viandes, œufs, poissons et assimilés', 'poissons crus', 'proteine'],
    ['fruits, légumes, légumineuses et oléagineux', 'légumes', 'legume'],
    ['fruits, légumes, légumineuses et oléagineux', 'légumineuses', 'feculent'],
    ['fruits, légumes, légumineuses et oléagineux', 'pommes de terre et autres tubercules', 'feculent'],
    ['fruits, légumes, légumineuses et oléagineux', 'fruits', 'autre'],
    ['fruits, légumes, légumineuses et oléagineux', 'fruits à coque et graines oléagineuses', 'autre'],
    ['produits céréaliers', 'pâtes, riz et céréales', 'feculent'],
    ['produits céréaliers', 'pains et assimilés', 'feculent'],
    ['aides culinaires et ingrédients divers', 'sauces', 'sauce'],
    ['matières grasses', 'huiles et graisses végétales', 'sauce'],
    ['produits laitiers et assimilés', 'fromages et assimilés', 'autre'],
    ['', '', 'autre'],
  ];
  for (const [groupe, sousGroupe, attendu] of cas) {
    it(`${sousGroupe || '(vide)'} → ${attendu}`, () => {
      expect(categorieDepuisGroupe(groupe, sousGroupe)).toBe(attendu);
    });
  }
});

// Petite table au format de public/ciqual.json
const table = {
  groupes: [
    ['fruits, légumes, légumineuses et oléagineux', 'fruits', 'autre'],
    ['fruits, légumes, légumineuses et oléagineux', 'légumineuses', 'feculent'],
    ['entrées et plats composés', 'desserts', 'autre'],
  ],
  aliments: [
    [13620, 'Compote de pomme, allégée en sucres', 2, 66, 0.3, 14.6, 0.1, 13.1, null],
    [13039, 'Pomme, pulpe et peau, crue', 0, 53.6, 0.3, 11.6, 0.3, 9.4, 1.6],
    [20587, 'Lentille verte, cuite', 1, 128, 10.1, 16.6, 0.6, 0.4, 8.5],
    [13000, 'Pomme, pulpe, crue', 0, 52, 0.25, 11.4, 0.2, null, 1.4],
  ],
};

describe('lecture et conversion', () => {
  it('ligne → aliment lisible (valeurs nulles omises)', () => {
    expect(lireAliment(table.aliments[3], table.groupes)).toEqual({
      code: 13000, nom: 'Pomme, pulpe, crue', groupe: 'fruits', categorie: 'autre',
      kcal: 52, proteines: 0.25, glucides: 11.4, lipides: 0.2, fibres: 1.4,
    });
  });
  it('aliment → ingrédient source « ciqual »', () => {
    const ing = alimentVersIngredient(lireAliment(table.aliments[2], table.groupes));
    expect(ing).toMatchObject({
      nom: 'Lentille verte, cuite', source: 'ciqual', codeCiqual: 20587, categorie: 'feculent', kcal: 128,
    });
  });
});

describe('recherche CIQUAL', () => {
  const noms = (r) => r.map((a) => a.nom);
  it('les noms qui commencent par le mot d\'abord, puis les plus courts', () => {
    expect(noms(rechercherCiqual(table, 'pomme'))).toEqual([
      'Pomme, pulpe, crue',
      'Pomme, pulpe et peau, crue',
      'Compote de pomme, allégée en sucres',
    ]);
  });
  it('sans accents, plusieurs mots, limite', () => {
    expect(noms(rechercherCiqual(table, 'LENTILLE cuite'))).toEqual(['Lentille verte, cuite']);
    expect(rechercherCiqual(table, 'pomme', 1)).toHaveLength(1);
  });
  it('recherche vide ou table absente', () => {
    expect(rechercherCiqual(table, '  ')).toEqual([]);
    expect(rechercherCiqual(null, 'pomme')).toEqual([]);
  });
});
