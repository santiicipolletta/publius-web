/**
 * Chequeo de integridad del contenido, antes de compilar.
 *
 * Astro avisa cuando una nota apunta a un autor que no existe, pero igual
 * termina de compilar y publica la nota sin firma. Con ~95 notas importadas
 * ese aviso se pierde entre el resto de la salida. Este script corta el build.
 *
 * Se ejecuta solo con `npm run build`. A mano: `npm run verificar`
 */
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const NOTAS = 'src/content/notas';
const AUTORES = 'src/content/autores';
const CATEGORIAS = ['Actualidad', 'Opinión', 'Investigación', 'Guerra', 'Shorts'];

const problemas = [];

/** Lee el frontmatter de un .md sin depender de librerías externas. */
async function leerFrontmatter(ruta) {
  /* replace() saca el BOM: algunos editores de Windows y PowerShell lo ponen
     al principio del archivo y ahí el frontmatter deja de reconocerse. */
  const texto = (await readFile(ruta, 'utf8')).replace(/^﻿/, '');
  const match = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const datos = {};
  for (const linea of match[1].split(/\r?\n/)) {
    const m = linea.match(/^([A-Za-zÀ-ÿ]+):\s*(.*)$/);
    if (!m) continue;
    const [, clave, bruto] = m;
    let valor = bruto.trim();

    if (valor.startsWith('[') && valor.endsWith(']')) {
      valor = valor
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      valor = valor.replace(/^["']|["']$/g, '');
    }
    datos[clave] = valor;
  }
  return datos;
}

async function listarMd(carpeta) {
  const archivos = await readdir(carpeta);
  return archivos.filter((f) => f.endsWith('.md'));
}

const archivosAutores = await listarMd(AUTORES);
const slugsAutores = new Set(archivosAutores.map((f) => basename(f, '.md')));

const archivosNotas = await listarMd(NOTAS);

for (const archivo of archivosNotas) {
  const slug = basename(archivo, '.md');
  const datos = await leerFrontmatter(join(NOTAS, archivo));

  if (!datos) {
    problemas.push(`${archivo}: no tiene frontmatter (el bloque entre ---)`);
    continue;
  }

  /* 1. El autor tiene que existir */
  if (!datos.autor) {
    problemas.push(`${archivo}: falta el campo "autor"`);
  } else if (!slugsAutores.has(datos.autor)) {
    problemas.push(
      `${archivo}: el autor "${datos.autor}" no existe.\n` +
        `      Creá src/content/autores/${datos.autor}.md, o corregí el campo.`,
    );
  }

  /* 2. Campos que no pueden faltar */
  for (const campo of ['titulo', 'extracto', 'fecha']) {
    if (!datos[campo]) problemas.push(`${archivo}: falta el campo "${campo}"`);
  }

  /* 3. Las categorías tienen que ser de la lista */
  const cats = Array.isArray(datos.categorias) ? datos.categorias : [];
  if (cats.length === 0) {
    problemas.push(`${archivo}: falta el campo "categorias"`);
  }
  for (const c of cats) {
    if (!CATEGORIAS.includes(c)) {
      problemas.push(
        `${archivo}: la categoría "${c}" no existe.\n` +
          `      Las válidas son: ${CATEGORIAS.join(', ')}`,
      );
    }
  }

  /* 4. Fecha con formato y valor razonables */
  if (datos.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) {
    problemas.push(`${archivo}: la fecha "${datos.fecha}" no tiene formato AAAA-MM-DD`);
  } else if (datos.fecha && Number.isNaN(Date.parse(datos.fecha))) {
    problemas.push(`${archivo}: la fecha "${datos.fecha}" no es una fecha real`);
  }

  /* 5. El nombre del archivo es la URL: sin acentos, eñes ni mayúsculas */
  if (!/^[a-z0-9-]+$/.test(slug)) {
    problemas.push(
      `${archivo}: el nombre del archivo va a la URL, así que sólo puede tener\n` +
        `      minúsculas, números y guiones (sin acentos, eñes ni espacios).`,
    );
  }
}

/* --- Resultado --- */
if (problemas.length > 0) {
  console.error(`\n  ✗ Hay ${problemas.length} problema(s) en el contenido:\n`);
  for (const p of problemas) console.error(`    · ${p}`);
  console.error('\n  No se compiló nada. Corregí lo de arriba y volvé a intentar.\n');
  process.exit(1);
}

console.log(
  `  ✓ Contenido OK: ${archivosNotas.length} nota(s), ${archivosAutores.length} autor(es).`,
);
