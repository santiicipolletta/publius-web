/**
 * Revisa que ningún enlace interno del sitio compilado apunte a una
 * página que no existe.
 *
 * Importa especialmente en este proyecto: las notas rescatadas traían
 * enlaces del sitio viejo que el importador reescribió a /notas/…, y
 * si alguno apunta a una nota que no se pudo recuperar, queda un link
 * muerto adentro del texto.
 *
 * Uso: node scripts/revisar-enlaces.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, '..', 'dist');

/** Todos los .html de dist, recursivo */
async function listarHtml(dir, acc = []) {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) await listarHtml(ruta, acc);
    else if (entrada.name.endsWith('.html')) acc.push(ruta);
  }
  return acc;
}

async function existe(ruta) {
  try {
    await stat(ruta);
    return true;
  } catch {
    return false;
  }
}

/** ¿A qué archivo de dist corresponde una ruta del sitio? */
async function resuelve(href) {
  const limpio = href.split('#')[0].split('?')[0];
  if (!limpio || limpio === '/') return existe(join(DIST, 'index.html'));

  const rel = limpio.replace(/^\/+/, '').replace(/\/+$/, '');
  /* Astro genera /notas/x/index.html, pero también puede haber
     archivos sueltos como /rss.xml o /robots.txt */
  return (
    (await existe(join(DIST, rel, 'index.html'))) ||
    (await existe(join(DIST, rel))) ||
    (await existe(join(DIST, `${rel}.html`)))
  );
}

const archivos = await listarHtml(DIST);
const rotos = new Map(); // href -> [páginas que lo contienen]
let revisados = 0;

for (const archivo of archivos) {
  const html = await readFile(archivo, 'utf8');
  const pagina = '/' + resolve(archivo).slice(resolve(DIST).length + 1).replace(/\\/g, '/').replace(/\/?index\.html$/, '');

  for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = m[1];

    /* Sólo los internos: los externos no se pueden verificar sin salir
       a la red, y los mailto/tel no son páginas. */
    if (!href.startsWith('/')) continue;
    if (href.startsWith('//')) continue;

    revisados++;
    if (await resuelve(href)) continue;

    const lista = rotos.get(href) ?? [];
    if (!lista.includes(pagina)) lista.push(pagina);
    rotos.set(href, lista);
  }
}

const linea = '  ' + '─'.repeat(60);
console.log('');
console.log(linea);
console.log(`  ENLACES INTERNOS — ${revisados} en ${archivos.length} páginas`);
console.log(linea);

if (rotos.size === 0) {
  console.log('\n  Ninguno roto.\n');
  process.exit(0);
}

console.log(`\n  ✗ ${rotos.size} destino(s) que no existen:\n`);
for (const [href, paginas] of [...rotos].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`    ${href}`);
  console.log(`      en ${paginas.length} página(s): ${paginas.slice(0, 3).join(', ')}${paginas.length > 3 ? '…' : ''}`);
}
console.log('');
process.exit(1);
