// Appel à l'API publique et gratuite Open Food Facts (aucun compte nécessaire).
import { produitVersIngredient } from '../calculs/openfoodfacts.js';

// On ne demande que les champs utiles : réponse plus légère et plus rapide.
const CHAMPS = 'product_name,product_name_fr,generic_name,generic_name_fr,brands,nutriments';
const DELAI_MAX_MS = 10000;

/**
 * Cherche un produit par code-barres.
 * Renvoie :
 * - { statut: 'trouve', ingredient } si Open Food Facts connaît le produit ;
 * - { statut: 'inconnu' } s'il ne le connaît pas ;
 * - { statut: 'erreur', message } si le réseau ne répond pas.
 */
export async function rechercherProduit(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${CHAMPS}`;
  try {
    // Abandonne au bout de 10 s (réseau très lent).
    const reponse = await fetch(url, { signal: AbortSignal.timeout(DELAI_MAX_MS) });
    // Produit inconnu : l'API répond 404 avec { status: 0 }.
    if (reponse.status === 404) return { statut: 'inconnu' };
    if (!reponse.ok) return { statut: 'erreur', message: `Open Food Facts a répondu ${reponse.status}.` };
    const ingredient = produitVersIngredient(await reponse.json(), code);
    return ingredient ? { statut: 'trouve', ingredient } : { statut: 'inconnu' };
  } catch {
    return {
      statut: 'erreur',
      message: navigator.onLine ? 'Open Food Facts ne répond pas.' : 'Pas de connexion internet.',
    };
  }
}
