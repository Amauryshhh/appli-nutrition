import { describe, it, expect } from 'vitest';
import {
  PARAMETRES_DEFAUT,
  metabolismeBase,
  depenseJournaliere,
  caloriesCibles,
  repartitionMacros,
  profilComplet,
  calculerObjectifs,
} from './objectifs.js';

// Profil de référence, valeurs calculées à la main.
const homme = {
  sexe: 'homme', age: 20, tailleCm: 175, poidsKg: 70,
  niveauActivite: 'modere', objectif: 'maintien',
};

describe('métabolisme de base (Mifflin-St Jeor)', () => {
  it('homme : 10×70 + 6,25×175 − 5×20 + 5 = 1698,75', () => {
    expect(metabolismeBase(homme)).toBeCloseTo(1698.75);
  });
  it('femme : 10×60 + 6,25×165 − 5×30 − 161 = 1320,25', () => {
    expect(metabolismeBase({ sexe: 'femme', age: 30, tailleCm: 165, poidsKg: 60 })).toBeCloseTo(1320.25);
  });
});

describe('dépense journalière', () => {
  it('modéré : 1698,75 × 1,55 = 2633,06', () => {
    expect(depenseJournaliere(1698.75, 'modere')).toBeCloseTo(2633.0625);
  });
  it('refuse un niveau inconnu', () => {
    expect(() => depenseJournaliere(1500, 'inconnu')).toThrow();
  });
  it('utilise les coefficients personnalisés', () => {
    const params = { ...PARAMETRES_DEFAUT, facteursActivite: { modere: 1.5 } };
    expect(depenseJournaliere(2000, 'modere', params)).toBe(3000);
  });
});

describe('calories cibles', () => {
  it('sèche = DJ × 0,85', () => expect(caloriesCibles(2000, 'seche')).toBeCloseTo(1700));
  it('maintien = DJ', () => expect(caloriesCibles(2000, 'maintien')).toBe(2000));
  it('prise de masse = DJ × 1,10', () => expect(caloriesCibles(2000, 'prise_de_masse')).toBeCloseTo(2200));
});

describe('répartition des macros', () => {
  it('70 kg, 2633 kcal : P = 140 g, L = 63 g, G = (2633 − 560 − 567) / 4 = 376,5 g', () => {
    const m = repartitionMacros(2633, 70);
    expect(m.proteines).toBeCloseTo(140);
    expect(m.lipides).toBeCloseTo(63);
    expect(m.glucides).toBeCloseTo(376.5);
  });
  it('la somme des macros redonne les calories', () => {
    const m = repartitionMacros(2500, 80);
    expect(m.proteines * 4 + m.glucides * 4 + m.lipides * 9).toBeCloseTo(2500);
  });
  it('glucides jamais négatifs', () => {
    expect(repartitionMacros(500, 100).glucides).toBe(0);
  });
});

describe('calcul complet', () => {
  it('profil de référence en maintien', () => {
    expect(calculerObjectifs(homme)).toEqual({
      mb: 1699, dj: 2633, kcal: 2633, proteines: 140, lipides: 63, glucides: 377,
    });
  });
  it('renvoie null si le profil est incomplet', () => {
    expect(calculerObjectifs({ ...homme, poidsKg: undefined })).toBeNull();
    expect(profilComplet({})).toBe(false);
  });
});
