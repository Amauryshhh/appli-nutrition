import { describe, it, expect } from 'vitest';
import { decoderXml, decoderEntites, lireEnregistrements, lireTeneur, construireTable } from './ciqual-xml.mjs';

// Extraits écrits à la main, au format des fichiers CIQUAL (espaces autour des valeurs compris).
const XML_ALIM = `<?xml version="1.0" encoding="windows-1252"?>
<TABLE>
<ALIM>
<alim_code> 13000 </alim_code>
<alim_nom_fr> Pomme, pulpe, crue </alim_nom_fr>
<alim_nom_index_fr> Pomme, pulpe, crue </alim_nom_index_fr>
<alim_grp_code> 02 </alim_grp_code>
<alim_ssgrp_code> 0204 </alim_ssgrp_code>
<alim_ssssgrp_code> 020401 </alim_ssssgrp_code>
</ALIM>
<ALIM>
<alim_code> 20587 </alim_code>
<alim_nom_fr> Lentille verte, cuite </alim_nom_fr>
<alim_grp_code> 02 </alim_grp_code>
<alim_ssgrp_code> 0203 </alim_ssgrp_code>
<alim_ssssgrp_code> 000000 </alim_ssssgrp_code>
</ALIM>
</TABLE>`;

const XML_GRP = `<TABLE>
<ALIM_GRP>
<alim_grp_code> 02 </alim_grp_code>
<alim_grp_nom_fr> fruits, légumes, légumineuses et oléagineux </alim_grp_nom_fr>
<alim_ssgrp_code> 0204 </alim_ssgrp_code>
<alim_ssgrp_nom_fr> fruits </alim_ssgrp_nom_fr>
</ALIM_GRP>
<ALIM_GRP>
<alim_grp_code> 02 </alim_grp_code>
<alim_grp_nom_fr> fruits, légumes, légumineuses et oléagineux </alim_grp_nom_fr>
<alim_ssgrp_code> 0203 </alim_ssgrp_code>
<alim_ssgrp_nom_fr> légumineuses </alim_ssgrp_nom_fr>
</ALIM_GRP>
</TABLE>`;

const compo = (alim, constituant, teneur) =>
  `<COMPO><alim_code> ${alim} </alim_code><const_code> ${constituant} </const_code><teneur> ${teneur} </teneur><min missing=" " /><code_confiance> A </code_confiance></COMPO>`;
const XML_COMPO = `<TABLE>
${compo(13000, 328, '52')}${compo(13000, 25000, '0,25')}${compo(13000, 31000, '11,4')}
${compo(13000, 40000, '< 0,5')}${compo(13000, 32000, '-')}${compo(13000, 34100, '1,4')}${compo(13000, 10110, '1,2')}
${compo(20587, 327, '536')}${compo(20587, 25000, '10,1')}${compo(20587, 31000, '16,6')}${compo(20587, 40000, 'traces')}
</TABLE>`;

const XML_CONST = `<TABLE>
<CONST><const_code> 328 </const_code><const_nom_fr> Energie, Règlement UE N° 1169/2011 (kcal/100 g) </const_nom_fr></CONST>
<CONST><const_code> 25000 </const_code><const_nom_fr> Protéines, N x facteur de Jones (g/100 g) </const_nom_fr></CONST>
</TABLE>`;

describe('lecture des fichiers XML', () => {
  it('décode l\'encodage windows-1252 annoncé dans l\'en-tête', () => {
    // « é » vaut 0xE9 en windows-1252 (mais 0xC3 0xA9 en UTF-8)
    const octets = Buffer.concat([
      Buffer.from('<?xml version="1.0" encoding="windows-1252"?><a>'),
      Buffer.from([0x70, 0xe2, 0x74, 0xe9]), // « pâté »
      Buffer.from('</a>'),
    ]);
    expect(decoderXml(octets)).toContain('<a>pâté</a>');
  });
  it('décode les entités XML', () => {
    expect(decoderEntites('Sel &amp; poivre &lt;3 &#233;t&#xE9;')).toBe('Sel & poivre <3 été');
  });
  it('lit les enregistrements et retire les espaces', () => {
    const alims = lireEnregistrements(XML_ALIM, 'ALIM');
    expect(alims).toHaveLength(2);
    expect(alims[0]).toMatchObject({ alim_code: '13000', alim_nom_fr: 'Pomme, pulpe, crue', alim_ssgrp_code: '0204' });
  });
  it('ignore les balises vides auto-fermantes', () => {
    const [c] = lireEnregistrements(compo(1, 328, '52'), 'COMPO');
    expect(c).toEqual({ alim_code: '1', const_code: '328', teneur: '52', code_confiance: 'A' });
  });
});

describe('teneurs', () => {
  it('nombre avec virgule', () => expect(lireTeneur(' 12,5 ')).toBe(12.5));
  it('traces et « < x » → 0', () => {
    expect(lireTeneur('traces')).toBe(0);
    expect(lireTeneur('< 0,5')).toBe(0);
  });
  it('« - » ou vide → inconnu', () => {
    expect(lireTeneur('-')).toBeUndefined();
    expect(lireTeneur('')).toBeUndefined();
    expect(lireTeneur('n.d.')).toBeUndefined();
  });
});

describe('construction de la table compacte', () => {
  const table = construireTable({
    alims: lireEnregistrements(XML_ALIM, 'ALIM'),
    groupes: lireEnregistrements(XML_GRP, 'ALIM_GRP'),
    compos: lireEnregistrements(XML_COMPO, 'COMPO'),
    constituants: lireEnregistrements(XML_CONST, 'CONST'),
  });

  it('groupes avec catégorie proposée', () => {
    expect(table.groupes).toEqual([
      ['fruits, légumes, légumineuses et oléagineux', 'fruits', 'autre'],
      ['fruits, légumes, légumineuses et oléagineux', 'légumineuses', 'feculent'],
    ]);
  });
  it('une ligne par aliment, valeurs inconnues à null, constituants inutiles ignorés', () => {
    expect(table.aliments[0]).toEqual([13000, 'Pomme, pulpe, crue', 0, 52, 0.25, 11.4, 0, null, 1.4]);
  });
  it('kcal calculées depuis les kJ si absentes (536 / 4,184 ≈ 128,11)', () => {
    expect(table.aliments[1]).toEqual([20587, 'Lentille verte, cuite', 1, 128.11, 10.1, 16.6, 0, null, null]);
  });
  it('rapport de vérification', () => {
    expect(table.rapport.nbAliments).toBe(2);
    expect(table.rapport.sansEnergie).toBe(0);
    expect(table.rapport.nomsConstituants.kcal).toMatch(/kcal/);
    expect(table.rapport.nomsConstituants.lipides).toBe('⚠ INTROUVABLE'); // absent de l'extrait
  });
});
