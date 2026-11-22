// Calcul des objectifs nutritionnels à partir du profil.
// Ce fichier ne touche ni à l'écran ni à la base : uniquement des calculs, faciles à tester.

// Valeurs par défaut des coefficients (modifiables dans l'onglet Paramètres).
export const PARAMETRES_DEFAUT = Object.freeze({
  // Facteur multiplicateur du métabolisme de base selon l'activité physique.
  facteursActivite: Object.freeze({
    sedentaire: 1.2,
    leger: 1.375,
    modere: 1.55,
    actif: 1.725,
    tres_actif: 1.9,
  }),
  // Multiplicateur de la dépense journalière selon l'objectif.
  multiplicateursObjectif: Object.freeze({
    seche: 0.85,
    maintien: 1,
    prise_de_masse: 1.1,
  }),
  proteinesParKg: 2, // g de protéines par kg de poids de corps
  lipidesParKg: 0.9, // g de lipides par kg de poids de corps
});

// Énergie apportée par gramme de chaque macronutriment.
export const KCAL_PAR_GRAMME = Object.freeze({ proteines: 4, glucides: 4, lipides: 9 });

/**
 * Métabolisme de base (kcal/jour), formule de Mifflin-St Jeor.
 * homme : 10 × poids + 6,25 × taille − 5 × âge + 5
 * femme : 10 × poids + 6,25 × taille − 5 × âge − 161
 */
export function metabolismeBase({ sexe, age, tailleCm, poidsKg }) {
  const base = 10 * poidsKg + 6.25 * tailleCm - 5 * age;
  return sexe === 'femme' ? base - 161 : base + 5;
}

/** Dépense journalière = métabolisme de base × facteur d'activité. */
export function depenseJournaliere(mb, niveauActivite, params = PARAMETRES_DEFAUT) {
  const facteur = params.facteursActivite[niveauActivite];
  if (facteur === undefined) throw new Error(`Niveau d'activité inconnu : ${niveauActivite}`);
  return mb * facteur;
}

/** Calories cibles = dépense journalière × multiplicateur de l'objectif. */
export function caloriesCibles(dj, objectif, params = PARAMETRES_DEFAUT) {
  const mult = params.multiplicateursObjectif[objectif];
  if (mult === undefined) throw new Error(`Objectif inconnu : ${objectif}`);
  return dj * mult;
}

/**
 * Répartition des macros (en grammes) :
 * - protéines et lipides sont fixés par kg de poids de corps ;
 * - les glucides prennent toutes les calories restantes.
 * Si protéines + lipides dépassent déjà les calories cibles, les glucides valent 0
 * (cas extrême : poids très élevé avec une forte sèche).
 */
export function repartitionMacros(kcal, poidsKg, params = PARAMETRES_DEFAUT) {
  const proteines = params.proteinesParKg * poidsKg;
  const lipides = params.lipidesParKg * poidsKg;
  const kcalRestantes =
    kcal - proteines * KCAL_PAR_GRAMME.proteines - lipides * KCAL_PAR_GRAMME.lipides;
  const glucides = Math.max(0, kcalRestantes / KCAL_PAR_GRAMME.glucides);
  return { proteines, lipides, glucides };
}

/** Vérifie que le profil contient tout ce qu'il faut pour calculer, avec des valeurs plausibles. */
export function profilComplet(p) {
  return Boolean(
    p &&
      (p.sexe === 'homme' || p.sexe === 'femme') &&
      p.age >= 10 && p.age <= 120 &&
      p.tailleCm >= 100 && p.tailleCm <= 250 &&
      p.poidsKg >= 30 && p.poidsKg <= 300 &&
      p.niveauActivite &&
      p.objectif,
  );
}

/**
 * Calcul complet, du profil aux objectifs du jour (valeurs arrondies à l'unité).
 * Renvoie null si le profil est incomplet.
 */
export function calculerObjectifs(profil, params = PARAMETRES_DEFAUT) {
  if (!profilComplet(profil)) return null;
  const mb = metabolismeBase(profil);
  const dj = depenseJournaliere(mb, profil.niveauActivite, params);
  const kcal = caloriesCibles(dj, profil.objectif, params);
  const m = repartitionMacros(kcal, profil.poidsKg, params);
  return {
    mb: Math.round(mb),
    dj: Math.round(dj),
    kcal: Math.round(kcal),
    proteines: Math.round(m.proteines),
    lipides: Math.round(m.lipides),
    glucides: Math.round(m.glucides),
  };
}
