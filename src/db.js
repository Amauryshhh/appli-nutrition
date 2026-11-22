import Dexie from 'dexie';

// Base IndexedDB stockée sur le téléphone.
// Pour l'instant une seule table « profil », remplie à l'étape 2.
// Quand on ajoutera des tables, on passera à db.version(2) sans effacer les données.
export const db = new Dexie('nutrition');

db.version(1).stores({
  // « id » est la clé primaire ; un seul profil (id = 1).
  profil: 'id',
});
