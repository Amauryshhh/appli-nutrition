// Chargement de la table CIQUAL (public/ciqual.json), une seule fois par lancement de l'appli.
// Le fichier n'est téléchargé qu'à la première recherche ; le service worker le garde ensuite
// pour le hors ligne.

let chargement = null;

/** Renvoie la table { groupes, aliments }, ou null si elle est indisponible. */
export function chargerCiqual() {
  chargement ??= fetch(`${import.meta.env.BASE_URL}ciqual.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((table) => {
      if (!table) chargement = null; // échec : on réessaiera à la prochaine recherche
      return table;
    });
  return chargement;
}
