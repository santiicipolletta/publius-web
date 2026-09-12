/**
 * Control de calidad de las notas rescatadas.
 *
 * La conversión de HTML a Markdown nunca sale perfecta. Este script
 * busca los restos típicos para saber qué revisar a mano, en lugar de
 * leer noventa y seis archivos de punta a punta.
 *
 * Uso: node scripts/rescate/revisar.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const NOTAS = join(AQUI, '..', '..', 'src', 'content', 'notas');

/* Cada control devuelve null si está bien, o el detalle del problema */
const CONTROLES = [
  {
    /* <strong> y <em> son intencionales: el énfasis se conserva como
       HTML en línea porque los asteriscos de Markdown se rompían con
       el marcado que generaba WordPress. Cualquier OTRA etiqueta sí
       es un resto de la conversión. */
    nombre: 'Etiqueta HTML sin convertir',
    grave: true,
    revisar: (cuerpo) => {
      const m = cuerpo.match(/<\/?(?:p|div|span|a|h[1-6]|ul|ol|li|img|figure|br|table|iframe)\b[^>]*>/i);
      return m ? m[0] : null;
    },
  },
  {
    nombre: 'Énfasis HTML mal cerrado',
    grave: true,
    revisar: (cuerpo) => {
      for (const t of ['strong', 'em']) {
        const abre = (cuerpo.match(new RegExp(`<${t}>`, 'g')) ?? []).length;
        const cierra = (cuerpo.match(new RegExp(`</${t}>`, 'g')) ?? []).length;
        if (abre !== cierra) return `${abre} <${t}> contra ${cierra} </${t}>`;
      }
      return null;
    },
  },
  {
    /* La bajada se imprime como texto plano en las tarjetas y en las
       etiquetas de Open Graph: una etiqueta HTML ahí se ve literal. */
    nombre: 'Bajada con HTML adentro',
    grave: true,
    revisar: (_, fm) => {
      const m = (fm.extracto ?? '').match(/<[^>]+>/);
      return m ? m[0] : null;
    },
  },
  {
    nombre: 'Asterisco de Markdown a la vista',
    grave: true,
    revisar: (cuerpo) => {
      const m = cuerpo.match(/\*/);
      return m ? `hay ${(cuerpo.match(/\*/g) ?? []).length} asterisco(s)` : null;
    },
  },
  {
    nombre: 'Entidad HTML sin decodificar',
    grave: true,
    revisar: (cuerpo) => {
      const m = cuerpo.match(/&(?:[a-zA-Z]{2,12}|#\d{2,5});/);
      return m ? m[0] : null;
    },
  },
  {
    nombre: 'Enlace al dominio caído',
    grave: true,
    revisar: (cuerpo) => {
      const m = cuerpo.match(/https?:\/\/(?:www\.)?publius\.com\.ar\S*/i);
      return m ? m[0].slice(0, 60) : null;
    },
  },
  {
    nombre: 'URL del Wayback en el texto',
    grave: true,
    revisar: (cuerpo) => (cuerpo.includes('web.archive.org') ? 'web.archive.org' : null),
  },
  {
    nombre: 'Markdown de imagen roto',
    grave: true,
    revisar: (cuerpo) => {
      const m = cuerpo.match(/!\[[^\]]*\]\([^)]*\)/);
      return m ? m[0].slice(0, 50) : null;
    },
  },
  {
    nombre: 'Firma "Por X" que quedó en el cuerpo',
    grave: false,
    revisar: (cuerpo) => {
      const primeras = cuerpo.split('\n\n').slice(0, 3).join('\n');
      const m = primeras.match(/^\**Por[:\s][^\n]{2,50}$/m);
      return m ? m[0].slice(0, 50) : null;
    },
  },
  {
    nombre: 'Restos del plugin de autor',
    grave: false,
    revisar: (cuerpo) => (/sabox|saboxplugin/i.test(cuerpo) ? 'sabox' : null),
  },
  {
    nombre: 'Cuerpo sospechosamente corto',
    grave: false,
    revisar: (cuerpo) => {
      const palabras = cuerpo.split(/\s+/).filter(Boolean).length;
      return palabras < 180 ? `${palabras} palabras` : null;
    },
  },
  {
    nombre: 'Bajada cortada a la mitad',
    grave: false,
    revisar: (_, fm) => {
      const e = fm.extracto ?? '';
      if (!e) return 'vacía';
      /* Si no termina en puntuación ni en puntos suspensivos, quedó cortada */
      return /[.!?…]$/.test(e) ? null : `…${e.slice(-40)}`;
    },
  },
  {
    nombre: 'Bajada que repite el título',
    grave: false,
    revisar: (_, fm) =>
      fm.extracto && fm.titulo && fm.extracto.startsWith(fm.titulo.slice(0, 25))
        ? 'arranca igual que el título'
        : null,
  },
  {
    nombre: 'Línea de una sola palabra (epígrafe suelto)',
    grave: false,
    revisar: (cuerpo) => {
      for (const p of cuerpo.split('\n\n')) {
        const t = p.trim();
        if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('-')) continue;
        const palabras = t.split(/\s+/).length;
        if (palabras > 0 && palabras <= 4 && t.length < 40) return t.slice(0, 40);
      }
      return null;
    },
  },
];

/* --- Lectura --- */
function partir(texto) {
  const m = texto.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;

  const fm = {};
  for (const linea of m[1].split(/\r?\n/)) {
    const c = linea.match(/^([A-Za-zÀ-ÿ]+):\s*(.*)$/);
    if (!c) continue;
    fm[c[1]] = c[2].trim().replace(/^"|"$/g, '');
  }
  return { fm, cuerpo: m[2].trim() };
}

const archivos = (await readdir(NOTAS)).filter((f) => f.endsWith('.md')).sort();
const hallazgos = new Map(); // control -> [{slug, detalle}]
let sinProblemas = 0;

for (const archivo of archivos) {
  const slug = basename(archivo, '.md');
  const partes = partir(await readFile(join(NOTAS, archivo), 'utf8'));
  if (!partes) {
    hallazgos.set('Frontmatter ilegible', [
      ...(hallazgos.get('Frontmatter ilegible') ?? []),
      { slug, detalle: '' },
    ]);
    continue;
  }

  let limpio = true;
  for (const control of CONTROLES) {
    const detalle = control.revisar(partes.cuerpo, partes.fm);
    if (detalle) {
      limpio = false;
      const clave = `${control.grave ? '✗' : '·'} ${control.nombre}`;
      hallazgos.set(clave, [...(hallazgos.get(clave) ?? []), { slug, detalle }]);
    }
  }
  if (limpio) sinProblemas++;
}

/* --- Informe --- */
const linea = '  ' + '─'.repeat(64);
console.log(`\n${linea}`);
console.log(`  REVISIÓN — ${archivos.length} notas`);
console.log(linea);
console.log(`\n  ${sinProblemas} sin observaciones · ${archivos.length - sinProblemas} con algo para mirar\n`);

const graves = [...hallazgos.entries()].filter(([k]) => k.startsWith('✗'));
const leves = [...hallazgos.entries()].filter(([k]) => k.startsWith('·'));

for (const grupo of [graves, leves]) {
  for (const [control, casos] of grupo.sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${control}  (${casos.length})`);
    for (const c of casos.slice(0, 6)) {
      console.log(`      ${c.slug.slice(0, 48).padEnd(50)} ${c.detalle}`);
    }
    if (casos.length > 6) console.log(`      … y ${casos.length - 6} más`);
    console.log('');
  }
}

if (graves.length === 0) {
  console.log('  Sin problemas graves: no quedó HTML, ni entidades, ni enlaces muertos.\n');
}
console.log(linea + '\n');

process.exit(graves.length > 0 ? 1 : 0);
