import { trouverParCodeBarres } from '../db.js';
import { codeBarresValide, nettoyerCodeBarres } from '../calculs/openfoodfacts.js';
import { rechercherProduit } from '../services/openfoodfacts.js';
import { html, echapper, surDepart, quitterVue } from './outils.js';
import { ouvrirFiche, afficherIngredients } from './ingredients.js';

/**
 * Écran de scan : caméra + saisie manuelle du code.
 * Une fois le code lu, on cherche dans la base, puis sur Open Food Facts.
 */
export async function ouvrirScan(conteneur) {
  conteneur.innerHTML = '';
  window.scrollTo(0, 0);

  const vue = html(`<section>
    <button type="button" class="retour">← Retour</button>
    <h1>Scanner</h1>
    <div class="camera">
      <!-- playsinline + muted : indispensables sur iPhone, sinon la vidéo s'ouvre en plein écran ou ne démarre pas -->
      <video playsinline muted autoplay></video>
      <!-- Aperçu redessiné à la main (voir dessinerApercu) : contourne l'écran noir de la vidéo sur iPhone -->
      <canvas></canvas>
      <div class="viseur"></div>
    </div>
    <p class="note" id="etat-camera">Démarrage de la caméra…</p>

    <form class="formulaire" id="manuel" autocomplete="off" novalidate>
      <label for="code">Ou tape les chiffres sous le code-barres</label>
      <input id="code" type="text" inputmode="numeric" placeholder="ex. 3017620422003" />
      <button type="submit" class="bouton">Rechercher</button>
    </form>
    <p class="info" id="message" hidden></p>
  </section>`);
  conteneur.append(vue);

  const $ = (s) => vue.querySelector(s);
  const etat = $('#etat-camera');
  const message = $('#message');
  let controles = null; // pour arrêter la caméra
  let enCours = false; // évite de traiter deux fois le même code
  let animation = null; // boucle de dessin de l'aperçu

  function arreterCamera() {
    if (animation) cancelAnimationFrame(animation);
    animation = null;
    controles?.stop();
    controles = null;
  }

  /**
   * Aperçu de la caméra dessiné sur un <canvas>, à chaque rafraîchissement d'écran.
   * Sur iPhone (appli installée), la balise <video> affiche parfois un écran noir alors
   * que les images arrivent bien : ZXing les lit justement en les copiant sur un canvas.
   * On fait donc pareil pour l'affichage.
   */
  function dessinerApercu(video, canvas) {
    const contexte = canvas.getContext('2d');
    const boucle = () => {
      // readyState ≥ 2 : la vidéo a une image disponible
      if (video.readyState >= 2 && video.videoWidth) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth; // résolution du canvas = celle de la caméra
          canvas.height = video.videoHeight;
        }
        contexte.drawImage(video, 0, 0);
      }
      animation = requestAnimationFrame(boucle);
    };
    boucle();
  }
  surDepart(arreterCamera); // arrêt automatique si on change d'onglet

  function afficherMessage(texte) {
    message.innerHTML = texte;
    message.hidden = false;
  }

  // ---- Que faire d'un code lu (caméra ou clavier) ----
  async function traiter(code) {
    if (enCours) return;
    enCours = true;
    quitterVue(); // arrête la caméra : on a ce qu'il faut
    etat.textContent = `Code ${code} : recherche…`;

    // 1. Déjà dans ma base ? On ouvre sa fiche (pas de doublon).
    const existant = await trouverParCodeBarres(code);
    if (existant) {
      ouvrirFiche(conteneur, existant.id);
      return;
    }

    // 2. Sinon, Open Food Facts.
    const resultat = await rechercherProduit(code);
    if (resultat.statut === 'trouve') {
      ouvrirFiche(conteneur, null, {
        initial: resultat.ingredient,
        message: 'Valeurs issues d\'Open Food Facts : vérifie-les, choisis la catégorie, puis enregistre.',
      });
    } else if (resultat.statut === 'inconnu') {
      ouvrirFiche(conteneur, null, {
        initial: { codeBarres: code },
        message: `Le code ${code} est inconnu d'Open Food Facts. Saisis les valeurs de l'étiquette.`,
      });
    } else {
      // 3. Erreur réseau : on propose de réessayer ou de saisir à la main.
      enCours = false;
      etat.textContent = '';
      afficherMessage(`${echapper(resultat.message)}
        <button type="button" class="bouton" id="reessayer">Réessayer</button>
        <button type="button" class="bouton" id="saisie">Saisir à la main</button>`);
      $('#reessayer').addEventListener('click', () => traiter(code));
      $('#saisie').addEventListener('click', () =>
        ouvrirFiche(conteneur, null, { initial: { codeBarres: code } }),
      );
    }
  }

  // ---- Saisie manuelle du code ----
  $('#manuel').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = nettoyerCodeBarres($('#code').value);
    if (!codeBarresValide(code)) {
      afficherMessage('Ce code ne semble pas valide : vérifie les chiffres (8, 12 ou 13 chiffres).');
      return;
    }
    traiter(code);
  });

  $('.retour').addEventListener('click', () => {
    quitterVue();
    conteneur.innerHTML = '';
    afficherIngredients(conteneur);
  });

  // ---- Caméra ----
  if (!navigator.mediaDevices?.getUserMedia) {
    etat.textContent = 'Caméra indisponible sur cet appareil : tape le code à la main.';
    return;
  }
  try {
    // La librairie n'est chargée qu'ici (import dynamique) : l'appli démarre plus vite.
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');
    // On ne cherche que les formats des produits alimentaires : plus rapide et moins d'erreurs.
    const indices = new Map([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
    ]);
    const lecteur = new BrowserMultiFormatReader(indices);

    const video = $('video');
    const ctrl = await lecteur.decodeFromConstraints(
      { video: { facingMode: 'environment' } }, // caméra arrière
      video,
      (resultat) => {
        if (!resultat) return; // rien de lisible sur cette image : on continue
        const code = resultat.getText();
        // La clé de contrôle écarte les lectures ratées : on attend une lecture correcte.
        if (codeBarresValide(code)) traiter(code);
      },
    );
    // Si l'utilisateur a quitté l'écran pendant le démarrage, on arrête tout de suite.
    if (!vue.isConnected || enCours) {
      ctrl.stop();
      return;
    }
    controles = ctrl;
    surDepart(arreterCamera); // ré-enregistré au cas où un essai manuel l'aurait déjà consommé
    dessinerApercu(video, $('canvas'));
    etat.textContent = 'Place le code-barres dans le cadre.';
  } catch (erreur) {
    etat.textContent =
      erreur?.name === 'NotAllowedError'
        ? 'Accès à la caméra refusé. Autorise-le dans Réglages → Safari → Caméra, ou tape le code à la main.'
        : 'Impossible de démarrer la caméra : tape le code à la main.';
    $('.camera').hidden = true;
  }
}
