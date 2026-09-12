/**
 * Genera los placeholders de imagen destacada, en SVG, dentro de
 * public/placeholders/.
 *
 * Son abstractos y en los colores de la marca, con motivos de tono
 * corporativo (análisis, instituciones, datos, redes). La idea es que
 * el sitio se vea terminado desde el día uno y que después cada nota
 * vaya reemplazando el suyo por una foto o gráfico real.
 *
 * Se hacen en SVG a propósito: pesan 1 KB, se ven nítidos en cualquier
 * pantalla y no dependen de ningún servicio externo que pueda caerse
 * — que es exactamente lo que nos pasó con el sitio anterior.
 *
 * Uso: npm run placeholders
 */
import { mkdir, writeFile } from 'node:fs/promises';

const NAVY = '#091528';
const CLARO = 'rgba(181,185,191,0.90)';
const MEDIO = 'rgba(181,185,191,0.42)';
const TENUE = 'rgba(181,185,191,0.16)';

const W = 1200;
const H = 800;

/** Envuelve el contenido en el SVG con fondo navy y una trama de base. */
function svg(interior) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
  <rect width="${W}" height="${H}" fill="${NAVY}"/>
  <g stroke="${TENUE}" stroke-width="1">
${Array.from({ length: 11 }, (_, i) => `    <line x1="0" y1="${(i + 1) * 66}" x2="${W}" y2="${(i + 1) * 66}"/>`).join('\n')}
  </g>
${interior}
</svg>
`;
}

/* --- 1. Análisis: barras ascendentes --- */
const alturas = [120, 210, 165, 300, 255, 390, 345, 470];
const analisis = svg(
  `  <g>
${alturas
  .map((alto, i) => {
    const x = 250 + i * 88;
    const fill = i === alturas.length - 1 ? CLARO : MEDIO;
    return `    <rect x="${x}" y="${H - 140 - alto}" width="46" height="${alto}" fill="${fill}"/>`;
  })
  .join('\n')}
    <line x1="220" y1="${H - 140}" x2="${W - 180}" y2="${H - 140}" stroke="${CLARO}" stroke-width="2"/>
  </g>`,
);

/* --- 2. Instituciones: columnas clásicas.
       Publius fue el seudónimo de los Federalist Papers: la columna
       es el motivo que más le corresponde a la marca. --- */
const columnas = svg(
  `  <g>
    <rect x="270" y="215" width="660" height="22" fill="${CLARO}"/>
    <polygon points="600,120 940,205 260,205" fill="${MEDIO}"/>
${Array.from({ length: 5 }, (_, i) => {
  const x = 305 + i * 148;
  return `    <rect x="${x}" y="255" width="58" height="330" fill="${i === 2 ? CLARO : MEDIO}"/>`;
}).join('\n')}
    <rect x="250" y="600" width="700" height="26" fill="${CLARO}"/>
  </g>`,
);

/* --- 3. Redes: nodos y vínculos --- */
const nodos = [
  [600, 400, 26],
  [360, 250, 15],
  [840, 250, 15],
  [300, 550, 15],
  [900, 545, 15],
  [600, 168, 12],
  [600, 636, 12],
  [190, 395, 11],
  [1010, 400, 11],
];
const redes = svg(
  `  <g stroke="${MEDIO}" stroke-width="1.5" fill="none">
${nodos
  .slice(1)
  .map(([x, y]) => `    <line x1="600" y1="400" x2="${x}" y2="${y}"/>`)
  .join('\n')}
    <path d="M360 250 L840 250 L900 545 L300 550 Z" stroke="${TENUE}"/>
  </g>
  <g>
${nodos
  .map(
    ([x, y, r], i) =>
      `    <circle cx="${x}" cy="${y}" r="${r}" fill="${i === 0 ? CLARO : MEDIO}"/>`,
  )
  .join('\n')}
  </g>`,
);

/* --- 4. Datos: arcos concéntricos --- */
function arco(radio, desde, hasta, color, grosor) {
  const cx = 600;
  const cy = 430;
  const rad = (g) => ((g - 90) * Math.PI) / 180;
  const x1 = cx + radio * Math.cos(rad(desde));
  const y1 = cy + radio * Math.sin(rad(desde));
  const x2 = cx + radio * Math.cos(rad(hasta));
  const y2 = cy + radio * Math.sin(rad(hasta));
  const grande = hasta - desde > 180 ? 1 : 0;
  return `    <path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radio} ${radio} 0 ${grande} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="butt"/>`;
}
const datos = svg(
  `  <g>
${arco(290, 0, 250, MEDIO, 30)}
${arco(290, 255, 330, CLARO, 30)}
${arco(230, 20, 200, TENUE, 24)}
${arco(230, 205, 300, MEDIO, 24)}
${arco(170, 0, 140, CLARO, 18)}
${arco(170, 148, 290, MEDIO, 18)}
    <circle cx="600" cy="430" r="58" fill="${MEDIO}"/>
  </g>`,
);

/* --- 5. Debate: dos campos que se solapan --- */
const debate = svg(
  `  <g>
    <circle cx="470" cy="400" r="215" fill="${MEDIO}"/>
    <circle cx="730" cy="400" r="215" fill="${TENUE}" stroke="${CLARO}" stroke-width="2"/>
    <line x1="600" y1="120" x2="600" y2="680" stroke="${CLARO}" stroke-width="2" stroke-dasharray="10 12"/>
  </g>`,
);

/* --- 6. Archivo: documentos apilados --- */
const archivo = svg(
  `  <g>
    <rect x="330" y="180" width="470" height="470" fill="${TENUE}" stroke="${MEDIO}" stroke-width="1.5"/>
    <rect x="370" y="150" width="470" height="470" fill="${TENUE}" stroke="${MEDIO}" stroke-width="1.5"/>
    <rect x="410" y="120" width="470" height="470" fill="${NAVY}" stroke="${CLARO}" stroke-width="2"/>
${Array.from({ length: 9 }, (_, i) => {
  const ancho = i === 0 ? 250 : [390, 360, 380, 300, 385, 340, 370, 240][i - 1];
  return `    <rect x="450" y="${170 + i * 46}" width="${ancho}" height="${i === 0 ? 14 : 8}" fill="${i === 0 ? CLARO : MEDIO}"/>`;
}).join('\n')}
  </g>`,
);

const salidas = {
  'analisis.svg': analisis,
  'instituciones.svg': columnas,
  'redes.svg': redes,
  'datos.svg': datos,
  'debate.svg': debate,
  'archivo.svg': archivo,
};

await mkdir('public/placeholders', { recursive: true });
for (const [nombre, contenido] of Object.entries(salidas)) {
  await writeFile(`public/placeholders/${nombre}`, contenido, 'utf8');
  console.log(`  ✓ public/placeholders/${nombre}`);
}
console.log(`\n  ${Object.keys(salidas).length} placeholders generados.`);
