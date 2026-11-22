// Génère les icônes PNG de l'appli (fond vert + rond blanc), sans librairie externe.
// Lancer avec : npm run icones
// Un PNG = une signature + des blocs (IHDR : dimensions, IDAT : pixels compressés, IEND : fin).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// Table CRC32, exigée par le format PNG pour chaque bloc.
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloc(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function icone(taille) {
  const vert = [0x2e, 0x7d, 0x32];
  const centre = taille / 2;
  const rayon = taille * 0.25; // rond dans la zone « sûre » (icône maskable)
  // Chaque ligne commence par un octet de filtre (0 = aucun), puis R,G,B par pixel.
  const brut = Buffer.alloc(taille * (1 + taille * 3));
  for (let y = 0; y < taille; y++) {
    const ligne = y * (1 + taille * 3);
    for (let x = 0; x < taille; x++) {
      const dans = (x - centre) ** 2 + (y - centre) ** 2 <= rayon ** 2;
      const [r, g, b] = dans ? [255, 255, 255] : vert;
      brut.set([r, g, b], ligne + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleurs RGB, sans transparence (iOS met un fond noir sinon)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(brut)),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', icone(192));
writeFileSync('public/icon-512.png', icone(512));
writeFileSync('public/apple-touch-icon.png', icone(180)); // taille attendue par iOS
console.log('Icônes générées dans public/');
