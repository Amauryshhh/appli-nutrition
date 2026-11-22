import { repasDuJour, chargerObjectifs } from '../db.js';
import {
  TYPES_REPAS,
  totalRepas,
  totalJour,
  resteAManger,
  progression,
  dateLocale,
  decalerJour,
  versDate,
} from '../calculs/journal.js';
import { echapper, html, formaterReste } from './outils.js';
import { ouvrirComposition } from './composer.js';

// Jour affiché (gardé en mémoire quand on revient de l'écran de composition).
let jourAffiche = null;

const BARRES = [
  ['kcal', 'Calories', 'kcal'],
  ['proteines', 'Protéines', 'g'],
  ['glucides', 'Glucides', 'g'],
  ['lipides', 'Lipides', 'g'],
];

const formatDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function titreDuJour(date) {
  const aujourdhui = dateLocale();
  if (date === aujourdhui) return "Aujourd'hui";
  if (date === decalerJour(aujourdhui, -1)) return 'Hier';
  if (date === decalerJour(aujourdhui, 1)) return 'Demain';
  const texte = formatDate.format(versDate(date));
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Description courte d'un repas : « Riz (100 g), Poulet (150 g) » ou le nom de la saisie rapide. */
function description(repas) {
  if (repas.saisieRapide) return repas.saisieRapide.nom || 'Saisie rapide';
  return repas.aliments.map((a) => `${a.nom} (${Math.round(a.grammes)} g)`).join(', ');
}

const STATUTS = { prevu: 'prévu', saute: 'sauté' };

export async function afficherJour(conteneur) {
  jourAffiche ??= dateLocale();
  const date = jourAffiche;
  const [repas, objectifs] = await Promise.all([repasDuJour(date), chargerObjectifs()]);
  const mange = totalJour(repas);

  const vue = html(`<section>
    <div class="entete-jour">
      <button type="button" class="fleche" data-decalage="-1" aria-label="Jour précédent">‹</button>
      <h1>${titreDuJour(date)}</h1>
      <button type="button" class="fleche" data-decalage="1" aria-label="Jour suivant">›</button>
    </div>
    ${date === dateLocale() ? '' : '<button type="button" class="lien-aujourdhui">Revenir à aujourd\'hui</button>'}

    <div class="carte progression">
      ${
        objectifs
          ? BARRES.map(([cle, libelle, unite]) => `
            <div class="barre-ligne">
              <div class="barre-texte"><span>${libelle}</span>
                <span>${Math.round(mange[cle])} / ${objectifs[cle]} ${unite}</span></div>
              <div class="barre"><div class="remplissage ${mange[cle] > objectifs[cle] * 1.05 ? 'trop' : ''}"
                style="width:${progression(mange[cle], objectifs[cle]) * 100}%"></div></div>
            </div>`).join('') +
            `<p class="reste"><strong>Il te reste :</strong> ${formaterReste(resteAManger(objectifs, mange))}</p>`
          : '<p class="vide">Remplis ton profil (onglet Profil) pour voir tes objectifs.</p>'
      }
    </div>

    ${TYPES_REPAS.map(([type, libelle]) => {
      const duType = repas.filter((r) => r.typeRepas === type);
      const kcalType = totalJour(duType).kcal;
      return `<div class="groupe-repas">
        <div class="titre-groupe">
          <h2>${libelle}</h2>
          <span>${kcalType ? `${Math.round(kcalType)} kcal` : ''}</span>
          <button type="button" class="ajouter" data-type="${type}" aria-label="Ajouter : ${libelle}">+</button>
        </div>
        <ul class="liste repas">
          ${duType.map((r) => `<li data-id="${r.id}" class="${r.statut !== 'valide' ? 'non-valide' : ''}">
            <div class="infos"><strong>${echapper(description(r))}</strong>
              ${STATUTS[r.statut] ? `<span class="badge">${STATUTS[r.statut]}</span>` : ''}</div>
            <span class="kcal-repas">${Math.round(totalRepas(r).kcal)} kcal</span>
          </li>`).join('')}
        </ul>
      </div>`;
    }).join('')}
  </section>`);
  conteneur.append(vue);

  const redessiner = () => {
    conteneur.innerHTML = '';
    window.scrollTo(0, 0);
    afficherJour(conteneur);
  };

  // Historique : jour précédent / suivant
  vue.querySelectorAll('.fleche').forEach((b) =>
    b.addEventListener('click', () => {
      jourAffiche = decalerJour(jourAffiche, Number(b.dataset.decalage));
      redessiner();
    }),
  );
  vue.querySelector('.lien-aujourdhui')?.addEventListener('click', () => {
    jourAffiche = dateLocale();
    redessiner();
  });

  // Nouveau repas d'un type donné
  vue.querySelectorAll('.ajouter').forEach((b) =>
    b.addEventListener('click', () =>
      ouvrirComposition(conteneur, { date, typeRepas: b.dataset.type }, redessiner),
    ),
  );

  // Modifier un repas existant
  vue.querySelectorAll('.repas li[data-id]').forEach((li) =>
    li.addEventListener('click', () => ouvrirComposition(conteneur, { id: Number(li.dataset.id) }, redessiner)),
  );
}
