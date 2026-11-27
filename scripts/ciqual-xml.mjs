// Lecture des fichiers XML de la table CIQUAL (sans librairie).
// La table est livrée en plusieurs fichiers :
//   alim_*.xml      : un <ALIM> par aliment (code, nom, codes de groupe)
//   alim_grp_*.xml  : un <ALIM_GRP> par sous-groupe (noms des groupes et sous-groupes)
//   const_*.xml     : un <CONST> par constituant (énergie, protéines…)
//   compo_*.xml     : un <COMPO> par couple (aliment, constituant) avec la teneur
// Le format est très régulier (pas d'attributs utiles, pas d'imbrication profonde) :
// des expressions régulières suffisent.
import { categorieDepuisGroupe } from '../src/calculs/ciqual.js';

// Codes des constituants utilisés (tables CIQUAL 2020 et 2025). Le script affiche leurs noms
// lus dans const_*.xml pour qu'on vérifie que ce sont bien les bons.
export const CONSTITUANTS = {
  kcal: '328', // Energie, Règlement UE N° 1169/2011 (kcal/100 g)
  kj: '327', // Energie, Règlement UE N° 1169/2011 (kJ/100 g)
  proteines: '25000', // Protéines, N x facteur de Jones (g/100 g)
  glucides: '31000', // Glucides (g/100 g)
  lipides: '40000', // Lipides (g/100 g)
  sucres: '32000', // Sucres (g/100 g)
  fibres: '34100', // Fibres alimentaires (g/100 g)
};

/** Décode un fichier selon l'encodage annoncé dans son en-tête (CIQUAL : windows-1252). */
export function decoderXml(octets) {
  const entete = Buffer.from(octets.subarray(0, 200)).toString('latin1');
  const encodage = /encoding="([^"]+)"/i.exec(entete)?.[1] ?? 'utf-8';
  return new TextDecoder(encodage).decode(octets);
}

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Remplace &amp; &lt; &#233; … par les vrais caractères. */
export function decoderEntites(texte) {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (tout, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITES[e] ?? tout;
  });
}

/**
 * Tous les enregistrements <balise>…</balise> d'un fichier, sous forme d'objets
 * { champ: texte } (texte sans espaces autour, entités décodées).
 * Les balises vides auto-fermantes (<min missing=" " />) sont ignorées.
 */
export function lireEnregistrements(xml, balise) {
  const enregistrements = [];
  const reBloc = new RegExp(`<${balise}>([\\s\\S]*?)</${balise}>`, 'g');
  const reChamp = /<(\w+)>([\s\S]*?)<\/\1>/g;
  for (const [, contenu] of xml.matchAll(reBloc)) {
    const objet = {};
    for (const [, champ, valeur] of contenu.matchAll(reChamp)) objet[champ] = decoderEntites(valeur.trim());
    enregistrements.push(objet);
  }
  return enregistrements;
}

/**
 * Teneur CIQUAL → nombre.
 * « 12,5 » → 12.5 · « traces » → 0 · « < 0,5 » → 0 (quantité négligeable)
 * « - » ou vide → undefined (non mesuré).
 */
export function lireTeneur(texte) {
  const t = String(texte ?? '').trim().toLowerCase();
  if (t === '' || t === '-') return undefined;
  if (t === 'traces' || t.startsWith('<')) return 0;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

const arrondir = (v) => (v === undefined ? null : Math.round(v * 100) / 100);

/**
 * Construit la table compacte de public/ciqual.json.
 * Entrées : les enregistrements lus dans les 4 fichiers.
 * Sortie : { groupes, aliments, rapport } (rapport = infos à vérifier, non écrit dans le JSON).
 */
export function construireTable({ alims, groupes, compos, constituants }) {
  // 1. Teneurs utiles, rangées par aliment : teneurs[codeAliment][cle] = nombre
  const cleParCode = Object.fromEntries(Object.entries(CONSTITUANTS).map(([cle, code]) => [code, cle]));
  const teneurs = new Map();
  for (const c of compos) {
    const cle = cleParCode[c.const_code];
    if (!cle) continue;
    if (!teneurs.has(c.alim_code)) teneurs.set(c.alim_code, {});
    teneurs.get(c.alim_code)[cle] = lireTeneur(c.teneur);
  }

  // 2. Noms des groupes / sous-groupes
  const nomsGroupes = new Map();
  for (const g of groupes) {
    nomsGroupes.set(`${g.alim_grp_code}|${g.alim_ssgrp_code}`, [g.alim_grp_nom_fr ?? '', g.alim_ssgrp_nom_fr ?? '']);
  }

  // 3. Une ligne par aliment ; les groupes sont stockés une seule fois (index)
  const tableGroupes = [];
  const indexGroupes = new Map();
  const aliments = [];
  let sansEnergie = 0;
  for (const a of alims) {
    const cleGroupe = `${a.alim_grp_code}|${a.alim_ssgrp_code}`;
    if (!indexGroupes.has(cleGroupe)) {
      const [nomGroupe, nomSousGroupe] = nomsGroupes.get(cleGroupe) ?? ['', ''];
      indexGroupes.set(cleGroupe, tableGroupes.length);
      tableGroupes.push([nomGroupe, nomSousGroupe, categorieDepuisGroupe(nomGroupe, nomSousGroupe)]);
    }
    const t = teneurs.get(a.alim_code) ?? {};
    // kcal manquantes : conversion depuis les kJ si disponibles
    const kcal = t.kcal ?? (t.kj !== undefined ? t.kj / 4.184 : undefined);
    if (kcal === undefined) sansEnergie++;
    aliments.push([
      Number(a.alim_code),
      a.alim_nom_fr,
      indexGroupes.get(cleGroupe),
      arrondir(kcal),
      arrondir(t.proteines),
      arrondir(t.glucides),
      arrondir(t.lipides),
      arrondir(t.sucres),
      arrondir(t.fibres),
    ]);
  }

  const nomsConstituants = Object.fromEntries(
    Object.entries(CONSTITUANTS).map(([cle, code]) => [
      cle,
      constituants.find((c) => c.const_code === code)?.const_nom_fr ?? '⚠ INTROUVABLE',
    ]),
  );
  return {
    groupes: tableGroupes,
    aliments,
    rapport: { nbAliments: aliments.length, nbGroupes: tableGroupes.length, sansEnergie, nomsConstituants },
  };
}
