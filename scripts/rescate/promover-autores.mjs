/**
 * Elimina el concepto de "Invitado": cada firma pasa a ser un autor
 * con su propia ficha y su propia página, para que se pueda buscar
 * por nombre como cualquier otro.
 *
 * Qué hace:
 *   1. Toma las notas con autor "invitado" y las reasigna a la firma real.
 *   2. Saca el campo firmaInvitado, que ya no tiene sentido.
 *   3. Crea la ficha de los autores nuevos.
 *   4. Borra la ficha "invitado".
 *
 * Uso: node scripts/rescate/promover-autores.mjs
 */
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const NOTAS = join(RAIZ, 'src', 'content', 'notas');
const AUTORES = join(RAIZ, 'src', 'content', 'autores');

/* --- Las seis notas donde el archivo no dejó la firma ------------
   Tres se resolvieron con otras fuentes; tres no tienen autor
   registrado en ninguna parte y van a la firma de redacción.
   No se inventa atribución: si no consta, no consta. */
const FIRMAS_RECUPERADAS = {
  /* La firma venía como subtítulo "### Por: Germán Tamagno" */
  'analisis-de-la-evolucion-del-estado-moderno-y-caracterizacion-de-sus-distintas-etapas':
    'Germán Tamagno',
  /* El nombre está en el archivo .docx original */
  'el-rey-de-la-tele-se-pone-de-rodillas': 'Juan Eduardo Wehner',
  'otra-vez-sopa-digo-lluvia': 'Juan Eduardo Wehner',
  /* Sin autor registrado en el archivo ni en los .docx */
  'el-humor-tiene-limites': 'Redacción Publius',
  'la-vicepresidencia-un-cargo-innecesario': 'Redacción Publius',
  'recursos-factores-que-afectan-las-relaciones-entre-rusia-y-la-union-europea':
    'Redacción Publius',
};

function aSlug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "Agustín Miño, Santiago Ochoa y Germán Tamagno" -> los tres nombres */
function separarFirmas(firma) {
  return firma
    .split(/\s*,\s*|\s+y\s+/)
    .map((n) => n.trim())
    .filter((n) => n.length > 2);
}

const archivos = (await readdir(NOTAS)).filter((f) => f.endsWith('.md'));
const nuevos = new Map(); // slug -> nombre
const cambios = [];

for (const archivo of archivos) {
  const ruta = join(NOTAS, archivo);
  let texto = await readFile(ruta, 'utf8');
  const slug = basename(archivo, '.md');

  if (!/^autor: invitado$/m.test(texto)) continue;

  /* De dónde sale la firma */
  const m = texto.match(/^firmaInvitado: "(.+)"$/m);
  const firmaCruda = m ? m[1] : FIRMAS_RECUPERADAS[slug];

  if (!firmaCruda) {
    console.error(`  ✗ ${slug}: sin firma y sin entrada en FIRMAS_RECUPERADAS`);
    process.exitCode = 1;
    continue;
  }

  const firmas = separarFirmas(firmaCruda);
  const principal = firmas[0];
  const coautores = firmas.slice(1);

  const slugPrincipal = aSlug(principal);
  nuevos.set(slugPrincipal, principal);
  for (const c of coautores) nuevos.set(aSlug(c), c);

  /* Reescribo el frontmatter */
  texto = texto.replace(/^autor: invitado$/m, `autor: ${slugPrincipal}`);
  texto = texto.replace(/^firmaInvitado: ".+"\r?\n/m, '');

  if (coautores.length) {
    /* Los coautores se guardan como slug, igual que el autor: así
       Astro valida que la ficha exista y se pueden enlazar. */
    const lista = coautores.map((c) => aSlug(c)).join(', ');
    texto = texto.replace(/^(autor: .+)$/m, `$1\ncoautores: [${lista}]`);
  }

  await writeFile(ruta, texto, 'utf8');
  cambios.push({ slug, autor: principal, coautores });
}

/* --- Fichas de los autores nuevos --- */
const creados = [];
for (const [slug, nombre] of [...nuevos].sort()) {
  const ruta = join(AUTORES, `${slug}.md`);
  if (existsSync(ruta)) continue;

  await writeFile(
    ruta,
    [
      '---',
      `nombre: "${nombre}"`,
      'temas: ["PENDIENTE"]',
      'presentacion: "PENDIENTE: describir sobre qué escribe."',
      'orden: 50',
      '---',
      '',
    ].join('\n'),
    'utf8',
  );
  creados.push({ slug, nombre });
}

/* --- Fuera la ficha "invitado" --- */
const fichaInvitado = join(AUTORES, 'invitado.md');
let borrada = false;
if (existsSync(fichaInvitado)) {
  await unlink(fichaInvitado);
  borrada = true;
}

/* --- Informe --- */
console.log(`\n  ${cambios.length} notas reasignadas:\n`);
for (const c of cambios.sort((a, b) => a.autor.localeCompare(b.autor, 'es'))) {
  const co = c.coautores.length ? `  (+ ${c.coautores.join(', ')})` : '';
  console.log(`    ${c.autor.padEnd(24)} ${c.slug.slice(0, 44)}${co}`);
}

console.log(`\n  ${creados.length} fichas de autor creadas:`);
for (const c of creados) console.log(`    ${c.nombre.padEnd(24)} ${c.slug}`);

if (borrada) console.log('\n  Ficha "invitado" eliminada: el concepto ya no existe.');
console.log('');
