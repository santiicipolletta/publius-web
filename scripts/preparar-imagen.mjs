/**
 * Prepara una foto para publicarla en el sitio.
 *
 * Qué hace y qué NO hace, para que quede claro:
 *   - Recorta al 16:9 que usa la destacada de la portada, centrado.
 *   - Afina el enfoque levemente: en una foto blanda mejora la nitidez
 *     percibida, pero NO inventa detalle que no esté en el original.
 *   - Comprime bien y saca los metadatos (cámara, ubicación, etc.).
 *
 * Lo que no puede hacer: agregar resolución real. Si el original es
 * chico, agrandarlo sólo infla el archivo e inventa píxeles borrosos.
 * Por eso el script avisa cuándo conviene no agrandar.
 *
 * Uso:
 *   node scripts/preparar-imagen.mjs <origen> <nombre-destino>
 *   node scripts/preparar-imagen.mjs foto.jpg fallo-cecim
 *
 * Deja el resultado en public/imagenes/<nombre-destino>.jpg
 */
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const DESTINO = join(RAIZ, 'public', 'imagenes');

const origen = process.argv[2];
const nombre = process.argv[3];
if (!origen || !nombre) {
  console.error('  Uso: node scripts/preparar-imagen.mjs <origen> <nombre-destino>');
  process.exit(1);
}

/* El ancho que realmente ocupa la destacada es 834 px. Con el doble
   alcanza para pantallas retina; más que eso es peso de más. */
const ANCHO_IDEAL = 1668;
const ALTO_IDEAL = Math.round((ANCHO_IDEAL * 9) / 16);

await mkdir(DESTINO, { recursive: true });

const meta = await sharp(origen).metadata();
const pesoOriginal = (await stat(origen)).size;

console.log(`\n  Original: ${meta.width}×${meta.height} ${meta.format}, ${(pesoOriginal / 1024).toFixed(0)} KB`);
console.log(`  Proporción: ${(meta.width / meta.height).toFixed(3)} (16:9 = 1.778)\n`);

/* No agrandar: si el original es más chico que lo ideal, se respeta su
   tamaño. Interpolar hacia arriba no suma información, sólo peso. */
const anchoFinal = Math.min(meta.width, ANCHO_IDEAL);
const altoFinal = Math.round((anchoFinal * 9) / 16);

if (meta.width < ANCHO_IDEAL) {
  console.log(`  ⚠ El original mide ${meta.width} px de ancho; lo ideal son ${ANCHO_IDEAL}.`);
  console.log(`    Se mantiene en ${anchoFinal} px: agrandarlo no agregaría detalle.\n`);
}

const base = sharp(origen)
  .resize(anchoFinal, altoFinal, { fit: 'cover', position: 'attention' })
  /* Enfoque suave: realza bordes sin generar halos */
  .sharpen({ sigma: 0.8, m1: 0.5, m2: 2 });

const salidaJpg = join(DESTINO, `${nombre}.jpg`);
await base
  .clone()
  .jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:4:4' })
  .toFile(salidaJpg);

const salidaWebp = join(DESTINO, `${nombre}.webp`);
await base.clone().webp({ quality: 82, effort: 6 }).toFile(salidaWebp);

const pesoJpg = (await stat(salidaJpg)).size;
const pesoWebp = (await stat(salidaWebp)).size;

console.log(`  ✓ public/imagenes/${nombre}.jpg    ${anchoFinal}×${altoFinal}  ${(pesoJpg / 1024).toFixed(0)} KB`);
console.log(`  ✓ public/imagenes/${nombre}.webp   ${anchoFinal}×${altoFinal}  ${(pesoWebp / 1024).toFixed(0)} KB`);

const mejor = pesoWebp < pesoJpg ? 'webp' : 'jpg';
console.log(`\n  Usá el .${mejor}: pesa ${Math.round((1 - Math.min(pesoJpg, pesoWebp) / pesoOriginal) * 100)}% menos que el original.`);
console.log(`\n  En el frontmatter de la nota:\n    imagen: "/imagenes/${nombre}.${mejor}"\n`);
