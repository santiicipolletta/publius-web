/**
 * ETAPA 2 — Bajar el HTML archivado de cada nota.
 *
 * Guarda cada página en una caché local. Está separado de la conversión
 * a propósito: el parser se puede ajustar y volver a correr todas las
 * veces que haga falta sin volver a descargar nada.
 *
 * Va de a una página por vez, con una pausa entre cada una. El Wayback
 * Machine es un archivo público y gratuito: no hay razón para apurarlo.
 *
 * Uso: node scripts/rescate/bajar.mjs
 *      node scripts/rescate/bajar.mjs --forzar   (ignora la caché)
 */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CACHE = join(AQUI, 'cache');
const FORZAR = process.argv.includes('--forzar');

const PAUSA_MS = 1200;
const INTENTOS = 3;

const notas = JSON.parse(await readFile(join(AQUI, 'notas-archivadas.json'), 'utf8'));
await mkdir(CACHE, { recursive: true });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function bajar(nota) {
  /* El sufijo id_ pide el HTML original, sin la barra de navegación
     que el Wayback inyecta en la versión para humanos. */
  const url = `https://web.archive.org/web/${nota.timestamp}id_/${nota.url}`;

  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'publius-rescate/1.0 (recuperacion de archivo propio)' },
        signal: AbortSignal.timeout(45000),
      });

      if (res.status === 429 || res.status >= 500) {
        const espera = PAUSA_MS * 4 * intento;
        console.log(`      ${res.status}, reintento en ${espera / 1000}s`);
        await dormir(espera);
        continue;
      }
      if (!res.ok) return { error: `HTTP ${res.status}` };

      const html = await res.text();
      if (html.length < 2000) return { error: `respuesta muy corta (${html.length} bytes)` };
      return { html };
    } catch (e) {
      if (intento === INTENTOS) return { error: e.message.slice(0, 70) };
      await dormir(PAUSA_MS * 3 * intento);
    }
  }
  return { error: 'agotó los reintentos' };
}

let bajadas = 0;
let desdeCache = 0;
const fallas = [];

console.log(`  ${notas.length} notas a recuperar.\n`);

for (const [i, nota] of notas.entries()) {
  const destino = join(CACHE, `${nota.slug}.html`);
  const pos = `[${String(i + 1).padStart(2)}/${notas.length}]`;

  if (!FORZAR) {
    try {
      const info = await stat(destino);
      if (info.size > 2000) {
        desdeCache++;
        continue;
      }
    } catch {
      /* no está en caché, sigue abajo */
    }
  }

  process.stdout.write(`  ${pos} ${nota.slug.slice(0, 58).padEnd(60)}`);
  const { html, error } = await bajar(nota);

  if (error) {
    console.log(`✗ ${error}`);
    fallas.push({ slug: nota.slug, error });
  } else {
    await writeFile(destino, html, 'utf8');
    console.log(`✓ ${(html.length / 1024).toFixed(0)} KB`);
    bajadas++;
  }

  await dormir(PAUSA_MS);
}

console.log('\n  ' + '-'.repeat(56));
console.log(`  ${bajadas} bajadas · ${desdeCache} ya estaban en caché · ${fallas.length} fallaron`);
if (fallas.length) {
  console.log('\n  Fallaron:');
  for (const f of fallas) console.log(`    ${f.slug} — ${f.error}`);
  console.log('\n  Volvé a correr el script: sólo reintenta las que faltan.');
}
console.log(`\n  Caché en scripts/rescate/cache/\n`);
