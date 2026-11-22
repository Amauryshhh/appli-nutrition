// Conversion (une seule fois) de la table CIQUAL XML en public/ciqual.json.
//
// 1. Télécharger le zip XML sur https://ciqual.anses.fr (ou via data.gouv.fr)
// 2. Le décompresser dans donnees/ciqual/ (dossier ignoré par Git)
// 3. Lancer : npm run ciqual
//
// Le script affiche un rapport à vérifier (nombre d'aliments, noms des constituants utilisés).
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decoderXml, lireEnregistrements, construireTable } from './ciqual-xml.mjs';
import { SOURCE_CIQUAL } from '../src/calculs/ciqual.js';

const dossier = process.argv[2] ?? 'donnees/ciqual';
const sortie = 'public/ciqual.json';

// Trouve le fichier dont le nom commence par le préfixe (ex. « alim_2020_07_07.xml »).
// « alim_grp_ » commence aussi par « alim_ » : on l'exclut explicitement.
function trouver(prefixe, exclure) {
  const fichiers = readdirSync(dossier).filter(
    (f) => f.toLowerCase().startsWith(prefixe) && f.toLowerCase().endsWith('.xml') && !(exclure && f.toLowerCase().startsWith(exclure)),
  );
  if (fichiers.length !== 1) {
    throw new Error(`Fichier « ${prefixe}*.xml » introuvable ou en double dans ${dossier} : ${fichiers.join(', ') || 'aucun'}`);
  }
  return join(dossier, fichiers[0]);
}

function lire(prefixe, balise, exclure) {
  const chemin = trouver(prefixe, exclure);
  const enregistrements = lireEnregistrements(decoderXml(readFileSync(chemin)), balise);
  console.log(`  ${chemin} : ${enregistrements.length} enregistrements <${balise}>`);
  return enregistrements;
}

console.log(`Lecture de ${dossier}…`);
const table = construireTable({
  alims: lire('alim_', 'ALIM', 'alim_grp_'),
  groupes: lire('alim_grp_', 'ALIM_GRP'),
  compos: lire('compo_', 'COMPO'),
  constituants: lire('const_', 'CONST'),
});

const { rapport, ...donnees } = table;
writeFileSync(sortie, JSON.stringify({ source: SOURCE_CIQUAL, ...donnees }));

console.log('\nConstituants utilisés (à vérifier) :');
for (const [cle, nom] of Object.entries(rapport.nomsConstituants)) console.log(`  ${cle.padEnd(10)} → ${nom}`);
console.log(`\n${rapport.nbAliments} aliments, ${rapport.nbGroupes} sous-groupes, ${rapport.sansEnergie} sans énergie connue.`);
console.log(`Écrit : ${sortie} (${Math.round(statSync(sortie).size / 1024)} Ko)`);
