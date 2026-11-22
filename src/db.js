import Dexie from 'dexie';
import { PARAMETRES_DEFAUT } from './calculs/objectifs.js';

// Base IndexedDB stockée sur le téléphone.
export const db = new Dexie('nutrition');

// Chaque fois qu'on ajoute une table, on crée une nouvelle version.
// Dexie migre tout seul la base du téléphone, sans effacer les données existantes.
db.version(1).stores({
  profil: 'id', // un seul profil, id = 1
});
db.version(2).stores({
  profil: 'id',
  parametres: 'id', // un seul jeu de coefficients, id = 1
});

const ID_UNIQUE = 1;

export async function chargerProfil() {
  return (await db.profil.get(ID_UNIQUE)) ?? {};
}

export async function enregistrerProfil(profil) {
  await db.profil.put({ ...profil, id: ID_UNIQUE });
}

/**
 * Renvoie les coefficients enregistrés, complétés par les valeurs par défaut.
 * (Utile si on ajoute un coefficient plus tard : il prendra sa valeur par défaut.)
 */
export async function chargerParametres() {
  const enregistres = (await db.parametres.get(ID_UNIQUE)) ?? {};
  return {
    facteursActivite: { ...PARAMETRES_DEFAUT.facteursActivite, ...enregistres.facteursActivite },
    multiplicateursObjectif: {
      ...PARAMETRES_DEFAUT.multiplicateursObjectif,
      ...enregistres.multiplicateursObjectif,
    },
    proteinesParKg: enregistres.proteinesParKg ?? PARAMETRES_DEFAUT.proteinesParKg,
    lipidesParKg: enregistres.lipidesParKg ?? PARAMETRES_DEFAUT.lipidesParKg,
  };
}

export async function enregistrerParametres(params) {
  await db.parametres.put({ ...params, id: ID_UNIQUE });
}

export async function reinitialiserParametres() {
  await db.parametres.delete(ID_UNIQUE);
}
