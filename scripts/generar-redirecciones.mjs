/**
 * Genera public/_redirects con las redirecciones del sitio viejo al nuevo.
 *
 * Por qué hace falta: en el WordPress anterior las notas vivían en la
 * raíz —publius.com.ar/chocobar-sera-justicia/— y acá viven bajo
 * /notas/. Cualquier link viejo que alguien tenga guardado, citado en
 * un trabajo o archivado apuntaría a una página que no existe.
 *
 * Con esto, publiusgroup.com/chocobar-sera-justicia lleva a la nota, y
 * lo mismo pasaría si algún día se recupera publius.com.ar y se apunta
 * a este sitio.
 *
 * El formato es el de Cloudflare Pages (y Netlify): redirecciones 301
 * del lado del servidor, que es lo que entienden los buscadores.
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

const lineas = [
  '# Generado por scripts/generar-redirecciones.mjs — no editar a mano.',
  '#',
  '# El sitio anterior era WordPress y tenía las notas en la raíz.',
  '# Estas reglas hacen que los links viejos sigan funcionando.',
  '',
  '# --- Taxonomías del WordPress viejo ---',
  '/author/*      /autores/:splat      301',
  '/category/*    /categoria/:splat    301',
  '/tag/*         /notas               301',
  '/page/*        /notas               301',
  '',
  '# --- Páginas fijas que cambiaron de nombre ---',
  '/home          /                    301',
  '/opinion       /categoria/opinion   301',
  '/actualidad    /categoria/actualidad 301',
  '/investigacion /categoria/investigacion 301',
  '/shorts        /categoria/shorts    301',
  '/spotify       /podcast             301',
  '/media         /podcast             301',
  '/autores/invitado /autores          301',
  '',
  `# --- Las ${slugs.length} notas: de la raíz a /notas/ ---`,
];

/* Una línea por nota. Van al final porque las reglas se evalúan en
   orden y estas son las más específicas.
   El alineado se topea: hay un slug de 143 caracteres y alinear todo
   contra él dejaría el archivo ilegible y cinco veces más grande. */
const TOPE = 46;
for (const slug of slugs) {
  const desde = `/${slug}`;
  const hacia = `/notas/${slug}`;
  lineas.push(`${desde.padEnd(TOPE)} ${hacia.padEnd(TOPE + 6)} 301`.replace(/\s+$/, ''));
}

const contenido = lineas.join('\n') + '\n';
await writeFile(join(RAIZ, 'public', '_redirects'), contenido, 'utf8');

const reglas = lineas.filter((l) => l.trim() && !l.startsWith('#')).length;
console.log(`  ✓ public/_redirects — ${reglas} reglas (${slugs.length} notas + taxonomías)`);
console.log(`    ${(contenido.length / 1024).toFixed(1)} KB`);
console.log('\n  Cloudflare Pages admite hasta 2100 redirecciones estáticas.');
