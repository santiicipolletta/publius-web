/**
 * ETAPA 1 — Listar las notas archivadas del sitio original.
 *
 * Consulta la CDX API del Wayback Machine y separa las notas de todo
 * lo demás: páginas de autor, de categoría, de tag, paginaciones,
 * archivos de WordPress y las páginas fijas.
 *
 * Deja el resultado en scripts/rescate/notas-archivadas.json
 *
 * Uso: node scripts/rescate/listar.mjs
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

const CDX =
  'https://web.archive.org/cdx/search/cdx' +
  '?url=publius.com.ar&matchType=domain' +
  '&fl=timestamp,original,statuscode' +
  '&collapse=urlkey' +
  '&filter=statuscode:200' +
  '&output=json';

/* Prefijos que no son notas: son índices, taxonomías o internos */
const PREFIJOS_EXCLUIDOS = [
  'author/',
  'category/',
  'tag/',
  'page/',
  'wp-admin/',
  'wp-content/',
  'wp-includes/',
  'wp-json/',
  'feed',
  'comments/',
];

/* Páginas fijas del sitio, no son notas */
const PAGINAS_FIJAS = new Set([
  '',
  'home',
  'contacto',
  'eventos',
  'media',
  'spotify',
  'shorts',
  'actualidad',
  'opinion',
  'investigacion',
  'guerra',
  'autores',
  'robots.txt',
  'favicon.ico',
  'sitemap.xml',
  'sitemap.rss',
  'sitemap-index.xml',
]);

console.log('  Consultando la CDX API del Wayback Machine...');

const res = await fetch(CDX, {
  headers: { 'User-Agent': 'publius-rescate/1.0 (recuperacion de archivo propio)' },
});
if (!res.ok) {
  console.error(`  ✗ La CDX API respondió ${res.status}`);
  process.exit(1);
}

const filas = await res.json();
const encabezado = filas.shift(); // ['timestamp','original','statuscode']
console.log(`  ${filas.length} capturas con estado 200.\n`);

/** Saca el slug de la URL archivada. */
function slugDe(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)publius\.com\.ar$/.test(u.hostname)) return null;
    /* Descarto las que traen query: son respuestas a comentarios y
       variantes del mismo contenido */
    if (u.search) return null;
    return decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g, '');
  } catch {
    return null;
  }
}

/* Una nota puede tener varias capturas: me quedo con la más reciente,
   que es la que tiene el texto más completo y corregido. */
const porSlug = new Map();
let descartadas = 0;

for (const [timestamp, original] of filas) {
  const slug = slugDe(original);

  if (slug === null) { descartadas++; continue; }
  if (PAGINAS_FIJAS.has(slug)) { descartadas++; continue; }
  if (PREFIJOS_EXCLUIDOS.some((p) => slug.startsWith(p))) { descartadas++; continue; }
  /* Las notas viven en la raíz: un solo segmento de path */
  if (slug.includes('/')) { descartadas++; continue; }
  /* Restos del borrador de WordPress */
  if (/^__trashed/.test(slug)) { descartadas++; continue; }
  /* Slugs truncados por el propio archivo, tipo "la-regulacion-del-derecho-a..." */
  if (slug.endsWith('...')) { descartadas++; continue; }

  const previa = porSlug.get(slug);
  if (!previa || timestamp > previa.timestamp) {
    porSlug.set(slug, { slug, timestamp, url: original });
  }
}

const notas = [...porSlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));

const salida = join(AQUI, 'notas-archivadas.json');
await writeFile(salida, JSON.stringify(notas, null, 2) + '\n', 'utf8');

console.log(`  ✓ ${notas.length} notas candidatas`);
console.log(`    ${descartadas} capturas descartadas (índices, taxonomías, internos)`);
console.log(`\n  Listado en scripts/rescate/notas-archivadas.json\n`);
console.log('  Primeras 15:');
for (const n of notas.slice(0, 15)) {
  console.log(`    ${n.timestamp.slice(0, 8)}  ${n.slug}`);
}
