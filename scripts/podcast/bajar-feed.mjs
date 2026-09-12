/**
 * Baja el feed del podcast y lo convierte en src/data/episodios.json
 *
 * El sitio se compila contra ese archivo, no contra el feed. Así el
 * build no depende de que Anchor esté en pie, y el resultado es
 * siempre el mismo. Cuando publiquen un episodio nuevo, se corre este
 * script otra vez y se vuelve a compilar.
 *
 * El feed sale de la API de Apple a partir del ID del programa, así
 * que no hay ninguna URL mágica escrita a mano acá.
 *
 * Uso: node scripts/podcast/bajar-feed.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');

/* El programa en Apple Podcasts. De acá sale la URL del feed. */
const ID_APPLE = 1553800644;

const UA = { 'User-Agent': 'publius-web/1.0 (armado del sitio propio)' };

/* --- Los dos ciclos -------------------------------------------
   Cada episodio se asigna mirando su título. Incluye el typo
   "Primera Prada" que quedó en un episodio, y el "Piloto", que es
   el episodio cero de Fuera de Contexto. */
const CICLOS = [
  {
    slug: 'primera-parada',
    nombre: 'Primera Parada',
    formato: 'Informativo diario',
    descripcion:
      'La información de lunes a viernes en episodios de cinco minutos. Lo que pasó y por qué importa, sin el ruido del minuto a minuto.',
    reconoce: (t) => /primera\s*p[ra]+ada/i.test(t),
    /* Para sacar el prefijo del título y quedarse con la fecha */
    recorta: /^primera\s*p[ra]+ada\s*[.:·-]?\s*/i,
  },
  {
    slug: 'fuera-de-contexto',
    nombre: 'Fuera de Contexto',
    formato: 'Entrevistas y debate',
    descripcion:
      'Conversaciones largas sobre una sola idea: transhumanismo, libertad de expresión, teoría de juegos, cultura. Un tema por episodio, sin apuro.',
    reconoce: (t) => /fuera\s*de\s*contexto/i.test(t) || /^\s*piloto\s*$/i.test(t),
    recorta: /^fuera\s*de\s*contexto\s*[.:·-]?\s*/i,
  },
];

/* ============================================================
   Utilidades de XML
   ============================================================ */

function limpiarCdata(t) {
  return t.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();
}

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', aacute: 'á', eacute: 'é', iacute: 'í',
  oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
};

function decodificar(t) {
  return t
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in ENTIDADES ? ENTIDADES[n] : m));
}

/** Saca el contenido de una etiqueta, con o sin CDATA */
function etiqueta(xml, nombre) {
  const m = xml.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`));
  return m ? decodificar(limpiarCdata(m[1])) : null;
}

/** Convierte la descripción HTML del episodio en texto corrido */
function aTexto(html) {
  if (!html) return '';
  return decodificar(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(p|div|li|br)\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]*>/g, ''),
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

/** "00:05:02" -> 302 segundos. También acepta "302" y "5:02". */
function aSegundos(d) {
  if (!d) return null;
  const partes = d.trim().split(':').map(Number);
  if (partes.some(Number.isNaN)) return null;
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return partes[0] * 60 + partes[1];
  return partes[0] * 3600 + partes[1] * 60 + partes[2];
}

/* ============================================================
   1. La URL del feed, desde Apple
   ============================================================ */
console.log('  Consultando la API de Apple...');
const lookup = await fetch(`https://itunes.apple.com/lookup?id=${ID_APPLE}&entity=podcast`, {
  headers: UA,
});
if (!lookup.ok) {
  console.error(`  ✗ La API de Apple respondió ${lookup.status}`);
  process.exit(1);
}
const datosApple = (await lookup.json()).results?.[0];
const urlFeed = datosApple?.feedUrl;
if (!urlFeed) {
  console.error('  ✗ Apple no devolvió la URL del feed');
  process.exit(1);
}
console.log(`  Feed: ${urlFeed}`);

/* ============================================================
   2. Bajar el feed
   ============================================================ */
const res = await fetch(urlFeed, { headers: UA, signal: AbortSignal.timeout(45000) });
if (!res.ok) {
  console.error(`  ✗ El feed respondió ${res.status}`);
  process.exit(1);
}
const xml = await res.text();
console.log(`  ${(xml.length / 1024).toFixed(0)} KB descargados\n`);

/* ============================================================
   3. Parsear
   ============================================================ */
const iPrimerItem = xml.indexOf('<item>');
const canalXml = iPrimerItem === -1 ? xml : xml.slice(0, iPrimerItem);

const portadaCanal =
  (canalXml.match(/<itunes:image[^>]*href="([^"]*)"/) ?? [])[1] ?? null;

const crudos = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

const episodios = [];
const sinCiclo = [];

for (const item of crudos) {
  const tituloCompleto = etiqueta(item, 'title');
  if (!tituloCompleto) continue;

  const ciclo = CICLOS.find((c) => c.reconoce(tituloCompleto));
  if (!ciclo) {
    sinCiclo.push(tituloCompleto);
    continue;
  }

  const pubDate = etiqueta(item, 'pubDate');
  const fecha = pubDate ? new Date(pubDate) : null;
  if (!fecha || Number.isNaN(fecha.valueOf())) {
    sinCiclo.push(`${tituloCompleto} (fecha ilegible)`);
    continue;
  }

  const audio = (item.match(/<enclosure[^>]*url="([^"]*)"/) ?? [])[1] ?? null;
  const duracion = aSegundos(etiqueta(item, 'itunes:duration'));

  /* El título sin el nombre del ciclo: en la página del ciclo el
     prefijo se repetiría en las 194 filas. */
  let corto = tituloCompleto.replace(ciclo.recorta, '').trim();
  corto = corto.replace(/^["“](.+)["”]$/, '$1').replace(/\s*\.\s*$/, '').trim();
  if (!corto) corto = tituloCompleto;

  episodios.push({
    id: etiqueta(item, 'guid') ?? audio ?? tituloCompleto,
    ciclo: ciclo.slug,
    titulo: corto,
    tituloCompleto,
    fecha: fecha.toISOString(),
    duracion,
    descripcion: aTexto(etiqueta(item, 'description')),
    audio,
    enlace: etiqueta(item, 'link'),
    temporada: Number(etiqueta(item, 'itunes:season')) || null,
    numero: Number(etiqueta(item, 'itunes:episode')) || null,
  });
}

/* Del más nuevo al más viejo */
episodios.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

/* ============================================================
   4. Guardar
   ============================================================ */
const salida = {
  actualizado: new Date().toISOString(),
  feed: urlFeed,
  portada: portadaCanal,
  ciclos: CICLOS.map(({ slug, nombre, formato, descripcion }) => ({
    slug,
    nombre,
    formato,
    descripcion,
    episodios: episodios.filter((e) => e.ciclo === slug).length,
  })),
  episodios,
};

await mkdir(join(RAIZ, 'src', 'data'), { recursive: true });
await writeFile(
  join(RAIZ, 'src', 'data', 'episodios.json'),
  JSON.stringify(salida, null, 2) + '\n',
  'utf8',
);

/* ============================================================
   Informe
   ============================================================ */
const linea = '  ' + '─'.repeat(60);
console.log(linea);
console.log(`  ${episodios.length} episodios guardados en src/data/episodios.json`);
console.log(linea);

for (const c of salida.ciclos) {
  console.log(`\n  ${c.nombre} — ${c.episodios} episodios`);
  const delCiclo = episodios.filter((e) => e.ciclo === c.slug);
  if (delCiclo.length) {
    const nuevo = delCiclo[0].fecha.slice(0, 10);
    const viejo = delCiclo[delCiclo.length - 1].fecha.slice(0, 10);
    console.log(`    de ${viejo} a ${nuevo}`);
    const conAudio = delCiclo.filter((e) => e.audio).length;
    const minutos = delCiclo.reduce((s, e) => s + (e.duracion ?? 0), 0) / 60;
    console.log(`    ${conAudio}/${delCiclo.length} con audio · ${Math.round(minutos)} minutos en total`);
    console.log(`    más reciente: ${delCiclo[0].titulo.slice(0, 60)}`);
  }
}

/* ¿Cuántas descripciones distintas hay? En un diario suelen repetir
   el mismo texto de cierre, y mostrarlo 194 veces sería ruido. */
const descripciones = new Map();
for (const e of episodios) {
  const d = e.descripcion.slice(0, 120);
  descripciones.set(d, (descripciones.get(d) ?? 0) + 1);
}
const repetidas = [...descripciones.entries()].filter(([, n]) => n > 3).sort((a, b) => b[1] - a[1]);
if (repetidas.length) {
  console.log(`\n  Descripciones repetidas (texto de cierre estándar):`);
  for (const [d, n] of repetidas.slice(0, 4)) {
    console.log(`    ${String(n).padStart(4)}x  ${d.slice(0, 74)}…`);
  }
}

if (sinCiclo.length) {
  console.log(`\n  ✗ Episodios que no se pudieron asignar a un ciclo (${sinCiclo.length}):`);
  for (const t of sinCiclo) console.log(`      ${t.slice(0, 70)}`);
  process.exitCode = 1;
} else {
  console.log('\n  Todos los episodios quedaron asignados a un ciclo.');
}
console.log('');
