/**
 * Genera las redirecciones y cabeceras del sitio, en los DOS formatos
 * que hacen falta:
 *
 *   vercel.json        → el que lee Vercel, donde está publicado el sitio
 *   public/_redirects  → el que leen Cloudflare Pages y Netlify
 *   public/_headers    → idem, para las cabeceras
 *
 * Los dos salen de la misma fuente a propósito. Cada plataforma usa su
 * propio formato y ninguna entiende el de la otra: con el sitio en
 * Vercel y sólo `_redirects`, las 106 reglas no harían absolutamente
 * nada y ningún error lo avisaría. Generando ambos, mudarse de hosting
 * no rompe nada.
 *
 * Por qué hacen falta las redirecciones: en el WordPress anterior las
 * notas vivían en la raíz —publius.com.ar/chocobar-sera-justicia/— y
 * acá viven bajo /notas/. Cualquier link viejo que alguien tenga
 * guardado, citado en un trabajo o que Google todavía tenga indexado
 * apuntaría a una página que no existe. Con esto, cada uno llega a su
 * nota y el posicionamiento del medio no se pierde.
 *
 * Uso: node scripts/generar-redirecciones.mjs
 */
import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

const slugs = (await readdir(join(RAIZ, 'src', 'content', 'notas')))
  .filter((f) => f.endsWith('.md'))
  .map((f) => basename(f, '.md'))
  .sort();

/* --- Las reglas, una sola vez ------------------------------------
   comodin: true  → la regla captura todo lo que siga (/author/fulano)
   comodin: false → coincidencia exacta */
const TAXONOMIAS = [
  { desde: '/author', hacia: '/autores', comodin: true },
  { desde: '/category', hacia: '/categoria', comodin: true },
  { desde: '/tag', hacia: '/notas', comodin: true, descarta: true },
  { desde: '/page', hacia: '/notas', comodin: true, descarta: true },
];

const FIJAS = [
  { desde: '/home', hacia: '/' },
  { desde: '/opinion', hacia: '/categoria/opinion' },
  { desde: '/actualidad', hacia: '/categoria/actualidad' },
  { desde: '/investigacion', hacia: '/categoria/investigacion' },
  { desde: '/shorts', hacia: '/categoria/shorts' },
  { desde: '/spotify', hacia: '/podcast' },
  { desde: '/media', hacia: '/podcast' },
  { desde: '/autores/invitado', hacia: '/autores' },
];

const NOTAS = slugs.map((s) => ({ desde: `/${s}`, hacia: `/notas/${s}` }));

/* --- Cabeceras HTTP --- */
const SEGURIDAD = [
  /* No permitir que otro sitio meta Publius dentro de un iframe */
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  /* No adivinar el tipo de archivo: usar el que declara el servidor */
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  /* Al salir del sitio, no filtrar la ruta completa de origen */
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  /* El sitio no usa cámara, micrófono ni ubicación */
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const CACHE = [
  /* Los archivos con hash en el nombre no cambian nunca */
  { ruta: '/_astro/(.*)', valor: 'public, max-age=31536000, immutable' },
  { ruta: '/placeholders/(.*)', valor: 'public, max-age=604800' },
];

/* ============================================================
   1. vercel.json — el que se usa en producción
   ============================================================ */
const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  redirects: [
    ...TAXONOMIAS.map((r) => ({
      source: `${r.desde}/:resto*`,
      destination: r.descarta ? r.hacia : `${r.hacia}/:resto*`,
      permanent: true,
    })),
    ...FIJAS.map((r) => ({ source: r.desde, destination: r.hacia, permanent: true })),
    ...NOTAS.map((r) => ({ source: r.desde, destination: r.hacia, permanent: true })),
  ],
  headers: [
    { source: '/(.*)', headers: SEGURIDAD },
    ...CACHE.map((c) => ({
      source: c.ruta,
      headers: [{ key: 'Cache-Control', value: c.valor }],
    })),
  ],
};

await writeFile(join(RAIZ, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n', 'utf8');

/* ============================================================
   2. public/_redirects y _headers — para Cloudflare o Netlify
   ============================================================ */
const TOPE = 46;
const fila = (desde, hacia) =>
  `${desde.padEnd(TOPE)} ${hacia.padEnd(TOPE + 6)} 301`.replace(/\s+$/, '');

const redirects = [
  '# Generado por scripts/generar-redirecciones.mjs — no editar a mano.',
  '#',
  '# Formato de Cloudflare Pages y Netlify. El sitio está en Vercel, que',
  '# usa vercel.json: este archivo queda para no depender de un hosting.',
  '',
  '# --- Taxonomías del WordPress viejo ---',
  ...TAXONOMIAS.map((r) =>
    fila(`${r.desde}/*`, r.descarta ? r.hacia : `${r.hacia}/:splat`),
  ),
  '',
  '# --- Páginas fijas que cambiaron de nombre ---',
  ...FIJAS.map((r) => fila(r.desde, r.hacia)),
  '',
  `# --- Las ${NOTAS.length} notas: de la raíz a /notas/ ---`,
  ...NOTAS.map((r) => fila(r.desde, r.hacia)),
];

await writeFile(join(RAIZ, 'public', '_redirects'), redirects.join('\n') + '\n', 'utf8');

const headers = [
  '# Generado por scripts/generar-redirecciones.mjs — no editar a mano.',
  '# Formato de Cloudflare Pages. En Vercel esto vive en vercel.json.',
  '',
  '/*',
  ...SEGURIDAD.map((h) => `  ${h.key}: ${h.value}`),
  '',
  ...CACHE.flatMap((c) => [c.ruta.replace('/(.*)', '/*'), `  Cache-Control: ${c.valor}`, '']),
];

await writeFile(join(RAIZ, 'public', '_headers'), headers.join('\n'), 'utf8');

/* --- Informe --- */
const total = vercel.redirects.length;
console.log(`  ✓ vercel.json         ${total} redirecciones + ${vercel.headers.length} bloques de cabeceras`);
console.log(`  ✓ public/_redirects   ${total} reglas (Cloudflare / Netlify)`);
console.log(`  ✓ public/_headers     ${SEGURIDAD.length} cabeceras de seguridad + cache`);
console.log(`\n    ${NOTAS.length} notas · ${FIJAS.length} páginas fijas · ${TAXONOMIAS.length} taxonomías`);
console.log('    Vercel admite hasta 1024 redirecciones en vercel.json.');
