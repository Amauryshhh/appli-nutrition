import { describe, it, expect } from 'vitest';
import {
  alimentDepuisIngredient,
  totalRepas,
  totalJour,
  resteAManger,
  progression,
  validerRepas,
  dateLocale,
  decalerJour,
} from './journal.js';

// On se place à l'heure de Paris pour tester le piège minuit / UTC.
process.env.TZ = 'Europe/Paris';

const riz = { id: 1, nom: 'Riz', kcal: 350, proteines: 8, glucides: 78, lipides: 1 };
const poulet = { id: 2, nom: 'Poulet', kcal: 110, proteines: 23, glucides: 0, lipides: 2 };

const dejeuner = {
  typeRepas: 'dejeuner',
  statut: 'valide',
  aliments: [alimentDepuisIngredient(riz, 100), alimentDepuisIngredient(poulet, 150)],
};

describe('total d\'un repas', () => {
  it('100 g de riz + 150 g de poulet', () => {
    // kcal : 350 + 165 = 515 · P : 8 + 34,5 = 42,5 · G : 78 · L : 1 + 3 = 4
    const t = totalRepas(dejeuner);
    expect(t.kcal).toBeCloseTo(515);
    expect(t.proteines).toBeCloseTo(42.5);
    expect(t.glucides).toBeCloseTo(78);
    expect(t.lipides).toBeCloseTo(4);
  });
  it('la copie des valeurs protège l\'historique', () => {
    const aliment = alimentDepuisIngredient(riz, 100);
    riz.kcal = 999; // l'ingrédient est modifié après coup…
    expect(totalRepas({ aliments: [aliment] }).kcal).toBe(350); // …le repas passé ne change pas
    riz.kcal = 350;
  });
  it('saisie rapide : valeurs prises telles quelles', () => {
    const t = totalRepas({ saisieRapide: { nom: 'Resto', kcal: 900, proteines: 30 } });
    expect(t).toEqual({ kcal: 900, proteines: 30, glucides: 0, lipides: 0 });
  });
  it('repas vide = 0', () => {
    expect(totalRepas({ aliments: [] }).kcal).toBe(0);
  });
});

describe('total du jour', () => {
  it('seuls les repas validés comptent', () => {
    const jour = [
      dejeuner,
      { ...dejeuner, statut: 'prevu' },
      { ...dejeuner, statut: 'saute' },
      { statut: 'valide', saisieRapide: { kcal: 200, proteines: 10, glucides: 20, lipides: 5 } },
    ];
    const t = totalJour(jour);
    expect(t.kcal).toBeCloseTo(715);
    expect(t.proteines).toBeCloseTo(52.5);
  });
  it('journée vide = 0', () => expect(totalJour([]).kcal).toBe(0));
});

describe('reste à manger', () => {
  const objectifs = { kcal: 2633, proteines: 140, glucides: 377, lipides: 63 };
  it('objectifs − mangé', () => {
    expect(resteAManger(objectifs, { kcal: 515, proteines: 42.5, glucides: 78, lipides: 4 })).toEqual({
      kcal: 2118, proteines: 97.5, glucides: 299, lipides: 59,
    });
  });
  it('négatif si dépassé', () => {
    expect(resteAManger(objectifs, { kcal: 3000, proteines: 0, glucides: 0, lipides: 0 }).kcal).toBe(-367);
  });
  it('progression bornée entre 0 et 1', () => {
    expect(progression(50, 200)).toBe(0.25);
    expect(progression(300, 200)).toBe(1);
    expect(progression(10, 0)).toBe(0);
  });
});

describe('validation d\'un repas', () => {
  it('repas correct', () => expect(validerRepas(dejeuner)).toEqual([]));
  it('type, ingrédients et grammes obligatoires', () => {
    expect(validerRepas({ aliments: [] })).toEqual(['Choisis le type de repas.', 'Ajoute au moins un ingrédient.']);
    const sansGrammes = { typeRepas: 'diner', aliments: [alimentDepuisIngredient(riz, undefined)] };
    expect(validerRepas(sansGrammes)).toEqual(['Indique une quantité en grammes pour chaque ingrédient.']);
  });
  it('saisie rapide : kcal obligatoires', () => {
    expect(validerRepas({ typeRepas: 'diner', saisieRapide: { nom: 'Resto' } })).toEqual(['Indique au moins les kcal.']);
    expect(validerRepas({ typeRepas: 'diner', saisieRapide: { kcal: 800 } })).toEqual([]);
  });
});

describe('dates en heure locale', () => {
  it('00 h 30 à Paris reste le bon jour (toISOString donnerait la veille)', () => {
    const minuitEtDemi = new Date(2026, 10, 23, 0, 30); // 23 novembre 2026, 00 h 30
    expect(minuitEtDemi.toISOString().slice(0, 10)).toBe('2026-11-22'); // le piège
    expect(dateLocale(minuitEtDemi)).toBe('2026-11-23'); // notre fonction
  });
  it('jour suivant / précédent, y compris changement de mois et d\'année', () => {
    expect(decalerJour('2026-11-22', 1)).toBe('2026-11-23');
    expect(decalerJour('2026-11-30', 1)).toBe('2026-12-01');
    expect(decalerJour('2026-12-31', 1)).toBe('2027-01-01');
    expect(decalerJour('2026-03-01', -1)).toBe('2026-02-28');
    expect(decalerJour('2026-03-29', 1)).toBe('2026-03-30'); // passage à l'heure d'été
  });
});
