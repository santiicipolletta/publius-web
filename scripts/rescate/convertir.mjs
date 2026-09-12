/**
 * ETAPA 3 — Convertir el HTML archivado a Markdown.
 *
 * Lee la caché de la etapa 2 y escribe un .md por nota en
 * src/content/notas/, con el autor, la fecha, las categorías y los
 * tags que traía el sitio original.
 *
 * De dónde sale cada dato:
 *   título, fecha, autor  → el JSON-LD que dejaba el plugin de SEO
 *   categorías y tags     → las clases del <article> (category-x, tag-y)
 *   cuerpo                → el div.entry-content
 *   bajada                → el primer párrafo, recortado
 *
 * No sobreescribe las notas que ya existen salvo que se pida:
 *   node scripts/rescate/convertir.mjs
 *   node scripts/rescate/convertir.mjs --sobreescribir
 *   node scripts/rescate/convertir.mjs --solo <slug>
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CACHE = join(AQUI, 'cache');
const RAIZ = join(AQUI, '..', '..');
const DESTINO_NOTAS = join(RAIZ, 'src', 'content', 'notas');
const DESTINO_AUTORES = join(RAIZ, 'src', 'content', 'autores');

const SOBREESCRIBIR = process.argv.includes('--sobreescribir');
const SOLO = process.argv.includes('--solo')
  ? process.argv[process.argv.indexOf('--solo') + 1]
  : null;

/* Las cinco categorías del sitio original, del slug al nombre */
const CATEGORIAS = {
  actualidad: 'Actualidad',
  opinion: 'Opinión',
  investigacion: 'Investigación',
  guerra: 'Guerra',
  shorts: 'Shorts',
};

/* ============================================================
   Utilidades de texto
   ============================================================ */

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', deg: '°',
  eacute: 'é', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', euro: '€', pound: '£',
  middot: '·', bull: '•', trade: '™', copy: '©', reg: '®', shy: '',
};

function decodificar(texto) {
  return texto
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in ENTIDADES ? ENTIDADES[n] : m));
}

/** Nombre de persona → slug de archivo. "Tomás Mesías" -> "tomas-mesias" */
function aSlug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca los acentos ya separados por NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Escapa un valor para meterlo entre comillas dobles en YAML */
function aYaml(texto) {
  return `"${texto.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/* ============================================================
   Extracción de metadatos
   ============================================================ */

function leerJsonLd(html) {
  const bloques = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];

  for (const b of bloques) {
    /* El JSON se parsea CRUDO. Decodificar las entidades antes de
       parsear rompe el JSON: un título entre comillas viene como
       &quot;, y al convertirlo en " se corta la cadena. Las entidades
       se decodifican después, sobre cada valor ya extraído. */
    let data;
    try {
      data = JSON.parse(b[1]);
    } catch {
      continue; // bloque roto, pruebo el siguiente
    }

    const grafo = data['@graph'] ?? [data];
    const tipos = (n) => [].concat(n['@type'] ?? []);

    const posteo = grafo.find(
      (n) => tipos(n).includes('BlogPosting') || tipos(n).includes('Article'),
    );
    const persona = grafo.find((n) => tipos(n).includes('Person'));
    if (posteo) return { posteo, persona };
  }
  return null;
}

/** Categorías y tags salen separados de las clases del <article> */
function leerTaxonomias(html) {
  const art = html.match(/<article[^>]*\sclass="([^"]*)"/);
  if (!art) return { categorias: [], tags: [], desconocidas: [] };

  const clases = art[1].split(/\s+/);
  const categorias = [];
  const desconocidas = [];
  const tags = [];

  for (const c of clases) {
    if (c.startsWith('category-')) {
      const slug = c.slice('category-'.length);
      if (CATEGORIAS[slug]) categorias.push(CATEGORIAS[slug]);
      else desconocidas.push(slug);
    } else if (c.startsWith('tag-')) {
      tags.push(c.slice('tag-'.length));
    }
  }
  return { categorias: [...new Set(categorias)], tags: [...new Set(tags)], desconocidas };
}

/** Recorta el div.entry-content balanceando los <div> anidados */
function recortarCuerpo(html) {
  const marca = html.search(/<div[^>]*class="[^"]*\bentry-content\b/);
  if (marca === -1) return null;

  const inicio = html.indexOf('>', marca) + 1;
  let profundidad = 1;
  let i = inicio;

  const re = /<\/?div\b/gi;
  re.lastIndex = inicio;
  let m;
  while ((m = re.exec(html))) {
    profundidad += m[0][1] === '/' ? -1 : 1;
    if (profundidad === 0) {
      i = m.index;
      break;
    }
  }
  return html.slice(inicio, i);
}

/* ============================================================
   HTML del cuerpo → Markdown
   ============================================================ */

function reescribirEnlace(href) {
  let url = decodificar(href).trim();

  /* Los enlaces internos quedaron reescritos por el Wayback: los desenvuelvo */
  const envuelto = url.match(/^https?:\/\/web\.archive\.org\/web\/[^/]*\/(https?:\/\/.+)$/i);
  if (envuelto) url = envuelto[1];

  /* Un enlace a otra nota del sitio pasa a ser interno */
  const interno = url.match(/^https?:\/\/(?:www\.)?publius\.com\.ar\/([^/?#]+)\/?$/i);
  if (interno) {
    const slug = interno[1].toLowerCase();

    /* Las taxonomías del WordPress viejo no son notas */
    if (/^(category|tag|author|page)$/.test(slug)) return null;

    /* Las páginas fijas tampoco: algunas tienen equivalente acá y
       otras no existen más. Sin esto, un enlace a /media/ terminaba
       apuntando a /notas/media, que no existe. */
    const FIJAS = {
      home: '/',
      media: '/podcast',
      spotify: '/podcast',
      youtube: '/podcast',
      opinion: '/categoria/opinion',
      actualidad: '/categoria/actualidad',
      investigacion: '/categoria/investigacion',
      guerra: '/categoria/guerra',
      shorts: '/categoria/shorts',
      autores: '/autores',
      /* Sin equivalente en el sitio nuevo: el enlace se cae y queda
         sólo el texto. */
      contacto: null,
      eventos: null,
    };
    if (slug in FIJAS) return FIJAS[slug];

    return `/notas/${slug}`;
  }

  /* El dominio está caído: cualquier otro enlace a él no sirve */
  if (/^https?:\/\/(?:www\.)?publius\.com\.ar/i.test(url)) return null;

  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function aMarkdown(htmlCuerpo, reporte) {
  let h = htmlCuerpo;

  /* Fuera lo que no es contenido */
  h = h.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '');
  h = h.replace(/<!--[\s\S]*?-->/g, '');

  /* Las imágenes vivían en el dominio caído: las anoto y las saco */
  const imagenes = [...h.matchAll(/<img[^>]*\ssrc="([^"]*)"/gi)].map((m) => m[1]);
  if (imagenes.length) reporte.imagenes.push(...imagenes);
  h = h.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n\n');
  h = h.replace(/<img[^>]*>/gi, '');

  /* El recuadro del autor que agregaba el plugin no es parte de la nota */
  h = h.replace(/<div[^>]*class="[^"]*sabox[\s\S]*$/i, '');

  /* --- Énfasis partido ---------------------------------------
     El editor de WordPress dejaba el énfasis cortado en pedazos:
     <strong>P</strong><strong>or Pedro</strong>. Convertido tal cual
     da "**P****or Pedro**", que rompe el Markdown. Primero unifico
     las etiquetas y después pego los tramos contiguos. */
  h = h.replace(/<\/?b\b([^>]*)>/gi, (m, at) => (m[1] === '/' ? '</strong>' : `<strong${at}>`));
  h = h.replace(/<\/?i\b([^>]*)>/gi, (m, at) => (m[1] === '/' ? '</em>' : `<em${at}>`));

  /* El editor alternaba el orden del anidado: un tramo venía como
     <em><strong>X</strong></em> y el siguiente como
     <strong><em>Y</em></strong>. Así los tramos contiguos no se
     reconocen entre sí. Fijo un orden único —strong por fuera— y
     recién entonces se pueden pegar. */
  {
    let antes;
    do {
      antes = h;
      h = h
        .replace(/<em(\s[^>]*)?><strong(\s[^>]*)?>/gi, '<strong$2><em$1>')
        .replace(/<\/strong>\s*<\/em>/gi, '</em></strong>');
    } while (h !== antes);
  }

  for (const etiqueta of ['strong', 'em']) {
    const contiguas = new RegExp(`</${etiqueta}>(\\s*)<${etiqueta}\\b[^>]*>`, 'gi');
    const vacias = new RegExp(`<${etiqueta}\\b[^>]*>(\\s*)</${etiqueta}>`, 'gi');
    let antes;
    do {
      antes = h;
      h = h.replace(contiguas, '$1').replace(vacias, '$1');
    } while (h !== antes);
  }

  /* --- Énfasis: se queda como HTML ---------------------------
     Los asteriscos de Markdown tienen reglas estrictas sobre dónde
     pueden abrir y cerrar: no valen pegados a puntuación ni cruzando
     un corte de párrafo. El editor de WordPress generaba justo esos
     casos, y el resultado era que el lector veía "**" en la página.
     Markdown acepta HTML en línea, así que <strong> y <em> se
     conservan tal cual: el formato queda idéntico al original y
     desaparece toda la clase de errores. Sólo les saco los atributos
     (colores y tamaños del tema viejo) para que hereden los del sitio. */
  h = h.replace(/<(strong|em)\b[^>]*>/gi, (_, t) => `<${t.toLowerCase()}>`);

  /* Deja sólo strong/em en el texto de los enlaces y titulares */
  const soloEnfasis = (t) => t.replace(/<(?!\/?(?:strong|em)>)[^>]*>/g, '').trim();

  h = h.replace(/<a\b[^>]*\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
    const url = reescribirEnlace(href);
    const texto = soloEnfasis(t);
    if (!url) return texto;
    return `[${texto}](${url})`;
  });
  h = h.replace(/<br\s*\/?>/gi, '\n');

  /* --- Bloques --- */
  h = h.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => {
    const nivel = Math.min(Math.max(Number(n), 2), 4); // h1 del cuerpo pasa a h2
    return `\n\n${'#'.repeat(nivel)} ${t.replace(/<[^>]*>/g, '').trim()}\n\n`;
  });

  h = h.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, dentro) => {
    const lineas = dentro
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<(?!\/?(?:strong|em)>)[^>]*>/g, '')
      .split(/\n{2,}/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `> ${l}`)
      .join('\n>\n');
    return `\n\n${lineas}\n\n`;
  });

  h = h.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${t.replace(/<[^>]*>/g, '').trim()}`);
  h = h.replace(/<\/(ul|ol)>/gi, '\n\n');
  h = h.replace(/<(ul|ol)\b[^>]*>/gi, '\n\n');

  h = h.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  h = h.replace(/<\/p>/gi, '\n\n');
  h = h.replace(/<p\b[^>]*>/gi, '');

  /* Lo que quede de markup se va, salvo el énfasis en línea */
  h = h.replace(/<(?!\/?(?:strong|em)>)[^>]*>/g, '');
  h = decodificar(h);

  /* Énfasis vacío o que sólo envuelve espacios: no aporta nada */
  {
    let antes;
    do {
      antes = h;
      h = h
        .replace(/<(strong|em)>(\s*)<\/\1>/g, '$2')
        .replace(/<\/(strong|em)>(\s*)<\1>/g, '$2');
    } while (h !== antes);
  }

  /* --- URLs pegadas a mano ------------------------------------
     Varios autores pegaban la dirección completa en lugar de poner
     un enlace. El dominio está caído, pero la nota que citan sí la
     recuperamos: la convierto en un enlace interno. */
  h = h.replace(
    /https?:\/\/(?:www\.)?publius\.com\.ar\/([a-z0-9][a-z0-9-]{3,})\/?/gi,
    (todo, slug) => {
      if (/^(category|tag|author|page|wp-[a-z]+)$/i.test(slug)) return '';
      return `[ver la nota](/notas/${slug.toLowerCase()})`;
    },
  );
  /* Cualquier otro resto del dominio caído no sirve para nada */
  h = h.replace(/https?:\/\/(?:www\.)?publius\.com\.ar\S*/gi, '');

  /* --- Limpieza final --- */
  const limpio = h
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');

  return limpio;
}

/** Detecta y saca la línea "Por Fulano" que venía dentro del texto */
function separarFirma(markdown) {
  const lineas = markdown.split('\n');
  for (let i = 0; i < Math.min(4, lineas.length); i++) {
    /* La firma venía en cursiva o negrita, así que hay que sacar el
       énfasis —ahora en HTML— antes de comparar. */
    const linea = lineas[i]
      .replace(/<\/?(?:strong|em)>/g, '')
      .trim()
      .replace(/^\*+|\*+$/g, '')
      .trim();
    /* Admite una firma o varias: "Por: Agustín Miño, Santiago Ochoa y
       Germán Tamagno" es una nota de tres autores invitados. */
    const m = linea.match(/^Por[:\s]+([A-ZÁÉÍÓÚÑ][^.;]{2,90})\.?$/);
    if (m) {
      lineas.splice(i, 1);
      return { cuerpo: lineas.join('\n').replace(/^\s+/, ''), firma: m[1].trim() };
    }
  }
  return { cuerpo: markdown, firma: null };
}

/** Bajada: el primer párrafo real, recortado en un límite prolijo */
function armarExtracto(markdown) {
  const parrafo = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('-') && p.length > 60);

  if (!parrafo) return null;

  const limpio = parrafo
    /* La bajada se muestra como texto plano en las tarjetas y en las
       etiquetas de Open Graph, así que el énfasis en HTML que sí va en
       el cuerpo acá tiene que salir. */
    .replace(/<[^>]*>/g, '')
    .replace(/[*_[\]]/g, '')
    .replace(/\(\/?[^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  /* La bajada siempre tiene que terminar cerrada: o en puntuación
     propia, o en puntos suspensivos que avisen que sigue. */
  const cerrar = (t) => {
    const s = t.replace(/[\s,;:—–-]+$/, '');
    return /[.!?…]$/.test(s) ? s : s + '…';
  };

  if (limpio.length <= 210) return cerrar(limpio);

  /* Corto en el último punto antes del límite; si no hay, en la última palabra */
  const recorte = limpio.slice(0, 210);
  const punto = recorte.lastIndexOf('. ');
  if (punto > 110) return recorte.slice(0, punto + 1).trim();
  return cerrar(recorte.slice(0, recorte.lastIndexOf(' ')));
}

/* ============================================================
   Recorrido principal
   ============================================================ */

const archivos = (await readdir(CACHE)).filter((f) => f.endsWith('.html'));
await mkdir(DESTINO_NOTAS, { recursive: true });

/* El timestamp de la captura sale del listado de la etapa 1.
   No se puede sacar del HTML: al pedirlo con el sufijo id_ el Wayback
   devuelve el original sin reescribir ninguna URL, así que no queda
   ninguna marca de la fecha adentro del documento. */
const listado = JSON.parse(await readFile(join(AQUI, 'notas-archivadas.json'), 'utf8'));
const capturas = new Map(listado.map((n) => [n.slug, n.timestamp]));

const reporteGlobal = {
  escritas: [],
  salteadas: [],
  rechazadas: [],
  autores: new Map(),
  invitados: [],
  categoriasDesconocidas: new Map(),
  sinImagen: 0,
  conImagenPerdida: [],
};

for (const archivo of archivos.sort()) {
  const slug = basename(archivo, '.html');
  if (SOLO && slug !== SOLO) continue;

  const html = await readFile(join(CACHE, archivo), 'utf8');

  /* --- Filtro: sólo notas. Descarta wp-login, páginas fijas, etc. --- */
  const ld = leerJsonLd(html);
  if (!ld) {
    reporteGlobal.rechazadas.push({ slug, razon: 'no es una nota (sin JSON-LD de BlogPosting)' });
    continue;
  }

  const cuerpoHtml = recortarCuerpo(html);
  if (!cuerpoHtml) {
    reporteGlobal.rechazadas.push({ slug, razon: 'no se encontró el div.entry-content' });
    continue;
  }

  const { posteo, persona } = ld;

  /* --- Título --- */
  let titulo = decodificar(posteo.headline ?? '').trim();
  titulo = titulo.replace(/\s*[-–—]\s*Publius\s*$/i, '').replace(/^["“]|["”]$/g, '').trim();
  if (!titulo) {
    reporteGlobal.rechazadas.push({ slug, razon: 'sin título' });
    continue;
  }

  /* --- Fecha: me quedo con la parte de día, tal como la guardó el sitio --- */
  const fecha = (posteo.datePublished ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    reporteGlobal.rechazadas.push({ slug, razon: `fecha ilegible: ${posteo.datePublished}` });
    continue;
  }

  /* --- Autor --- */
  const nombreAutor = decodificar(persona?.name ?? 'Invitado').trim() || 'Invitado';
  const slugAutor = aSlug(nombreAutor);

  /* --- Taxonomías --- */
  const { categorias, tags, desconocidas } = leerTaxonomias(html);
  for (const d of desconocidas) {
    reporteGlobal.categoriasDesconocidas.set(d, (reporteGlobal.categoriasDesconocidas.get(d) ?? 0) + 1);
  }

  /* --- Cuerpo --- */
  const reporte = { imagenes: [] };
  let markdown = aMarkdown(cuerpoHtml, reporte);

  /* Si la primera línea repite el título, se va */
  const primera = markdown.split('\n')[0]?.trim().replace(/[*#>"“”]/g, '').trim();
  if (primera && aSlug(primera) === aSlug(titulo)) {
    markdown = markdown.split('\n').slice(1).join('\n').replace(/^\s+/, '');
  }

  const { cuerpo, firma } = separarFirma(markdown);
  markdown = cuerpo;

  if (markdown.length < 400) {
    reporteGlobal.rechazadas.push({ slug, razon: `cuerpo muy corto (${markdown.length} caracteres)` });
    continue;
  }

  const extracto = armarExtracto(markdown);
  if (!extracto) {
    reporteGlobal.rechazadas.push({ slug, razon: 'no se pudo armar la bajada' });
    continue;
  }

  /* --- No piso lo que ya existe sin que me lo pidan --- */
  const destino = join(DESTINO_NOTAS, `${slug}.md`);
  if (existsSync(destino) && !SOBREESCRIBIR) {
    reporteGlobal.salteadas.push(slug);
    continue;
  }

  /* --- Frontmatter --- */
  const fm = [
    '---',
    `titulo: ${aYaml(titulo)}`,
    `extracto: ${aYaml(extracto)}`,
    `autor: ${slugAutor}`,
    firma && slugAutor === 'invitado' ? `firmaInvitado: ${aYaml(firma)}` : null,
    `fecha: ${fecha}`,
    `categorias: [${(categorias.length ? categorias : ['Opinión']).map((c) => `"${c}"`).join(', ')}]`,
    tags.length ? `tags: [${tags.map((t) => `"${t}"`).join(', ')}]` : null,
    `fuenteOriginal: "https://web.archive.org/web/${capturas.get(slug)}/https://publius.com.ar/${slug}/"`,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  await writeFile(destino, `${fm}\n\n${markdown}\n`, 'utf8');

  reporteGlobal.escritas.push({ slug, titulo, autor: nombreAutor, fecha, categorias, palabras: markdown.split(/\s+/).length });
  reporteGlobal.autores.set(slugAutor, nombreAutor);
  if (firma && slugAutor === 'invitado') reporteGlobal.invitados.push({ slug, firma });
  if (reporte.imagenes.length) reporteGlobal.conImagenPerdida.push({ slug, cantidad: reporte.imagenes.length });
  else reporteGlobal.sinImagen++;
}

/* ============================================================
   Autores que faltan
   ============================================================ */

const autoresFaltantes = [];
for (const [slugAutor, nombre] of reporteGlobal.autores) {
  const ruta = join(DESTINO_AUTORES, `${slugAutor}.md`);
  if (existsSync(ruta)) continue;

  const esInvitado = slugAutor === 'invitado';
  const fm = [
    '---',
    `nombre: ${aYaml(esInvitado ? 'Invitado' : nombre)}`,
    `rol: "Invitado"`,
    `presentacion: ${aYaml(
      esInvitado
        ? 'Firmas invitadas que publicaron en Publius Group.'
        : 'PENDIENTE: completar la presentación de esta persona.',
    )}`,
    `orden: ${esInvitado ? 90 : 50}`,
    '---',
    '',
    esInvitado
      ? 'Notas de autores invitados. El nombre de cada firma aparece en la nota\ncorrespondiente.'
      : `<!-- PENDIENTE: bio de ${nombre}. Se recuperó el nombre del archivo del\n     sitio original, pero el rol y la biografía hay que completarlos. -->`,
    '',
  ].join('\n');

  await writeFile(ruta, fm, 'utf8');
  autoresFaltantes.push({ slugAutor, nombre });
}

/* ============================================================
   Informe
   ============================================================ */

const R = reporteGlobal;
const linea = '  ' + '─'.repeat(64);

console.log('');
console.log(linea);
console.log(`  RESCATE — ${R.escritas.length} notas escritas`);
console.log(linea);

if (R.salteadas.length) {
  console.log(`\n  Ya existían, no se tocaron (${R.salteadas.length}):`);
  console.log(`    ${R.salteadas.join(', ')}`);
  console.log('    Para reemplazarlas: --sobreescribir');
}

if (R.rechazadas.length) {
  console.log(`\n  No se pudieron convertir (${R.rechazadas.length}):`);
  for (const r of R.rechazadas) console.log(`    ${r.slug.padEnd(52)} ${r.razon}`);
}

console.log(`\n  Autores encontrados (${R.autores.size}):`);
const porAutor = new Map();
for (const e of R.escritas) porAutor.set(e.autor, (porAutor.get(e.autor) ?? 0) + 1);
for (const [nombre, n] of [...porAutor.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(3)} notas  ${nombre}`);
}

if (autoresFaltantes.length) {
  console.log(`\n  Fichas de autor creadas, con la bio PENDIENTE (${autoresFaltantes.length}):`);
  for (const a of autoresFaltantes) console.log(`    src/content/autores/${a.slugAutor}.md`);
}

if (R.invitados.length) {
  console.log(`\n  Notas de invitados con la firma real detectada (${R.invitados.length}):`);
  for (const i of R.invitados) console.log(`    ${i.firma.padEnd(28)} ${i.slug}`);
}

const porCategoria = new Map();
for (const e of R.escritas) for (const c of e.categorias) porCategoria.set(c, (porCategoria.get(c) ?? 0) + 1);
console.log('\n  Por categoría:');
for (const [c, n] of [...porCategoria.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(3)}  ${c}`);
}

if (R.categoriasDesconocidas.size) {
  console.log('\n  Categorías del sitio viejo que no están en el esquema:');
  for (const [c, n] of R.categoriasDesconocidas) console.log(`    ${c} (${n} notas)`);
}

if (R.conImagenPerdida.length) {
  console.log(`\n  Notas que tenían imágenes propias en el sitio caído (${R.conImagenPerdida.length}):`);
  console.log('    Los archivos vivían en publius.com.ar/wp-content, que ya no responde.');
  console.log('    Por ahora usan un placeholder de la marca.');
}

const anios = new Map();
for (const e of R.escritas) anios.set(e.fecha.slice(0, 4), (anios.get(e.fecha.slice(0, 4)) ?? 0) + 1);
console.log('\n  Por año:');
for (const [a, n] of [...anios.entries()].sort()) console.log(`    ${a}  ${'█'.repeat(n)} ${n}`);

const palabras = R.escritas.reduce((s, e) => s + e.palabras, 0);
console.log(`\n  Total recuperado: ${palabras.toLocaleString('es-AR')} palabras`);
console.log(linea + '\n');
