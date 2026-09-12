/**
 * Escribe las fichas de autor.
 *
 * La presentación NO es una biografía: describe de qué escribe cada
 * persona, según los temas que efectivamente aparecen en sus notas.
 * Cada texto de acá abajo se redactó leyendo los títulos y las
 * categorías reales de ese autor, no a partir de datos personales.
 *
 * También corrige los nombres que el WordPress viejo guardó sin
 * acentos, y fusiona la ficha de Pedro Enríquez, que había quedado
 * duplicada porque el sitio original tenía el nombre invertido.
 *
 * Uso: node scripts/rescate/escribir-fichas.mjs
 */
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const NOTAS = join(RAIZ, 'src', 'content', 'notas');
const AUTORES = join(RAIZ, 'src', 'content', 'autores');

/* --- Fusión: el sitio viejo tenía este nombre invertido ----------
   "Enriquez Pedro" y "Pedro Enríquez" son la misma persona. La firma
   dentro del cuerpo de su nota en el Sahel dice "Por Pedro Enríquez",
   y la página de autor del sitio original era /author/pedro-enriquez/.
   Así que el orden correcto es el segundo. */
const FUSIONES = { 'enriquez-pedro': 'pedro-enriquez' };

/* --- Las fichas ---------------------------------------------------
   orden: 1 es dirección; 10, las firmas con obra sostenida en el
   medio; 50, el resto. Dentro de cada grupo se ordena alfabéticamente. */
const FICHAS = {
  'manuel-carrasco': {
    nombre: 'Manuel Carrasco',
    rol: 'Dirección',
    temas: ['Democracia', 'Derecho', 'Memoria histórica'],
    presentacion:
      'Escribe sobre democracia y derecho: la paradoja de votar en Argentina, el oficio de abogado visto desde la puerta de entrada y las versiones de la historia que terminan volviéndose oficiales.',
    orden: 1,
  },
  'thiago-noguerol': {
    nombre: 'Thiago Noguerol',
    temas: ['Política argentina', 'Justicia', 'Elecciones', 'Federalismo'],
    presentacion:
      'Sigue la política argentina día por día: la Corte Suprema y el juicio político, las PASO y los armados electorales, los conflictos federales de Mendoza y Formosa, y qué sostiene a la militancia cuando no hay nada que festejar.',
    orden: 10,
  },
  'tomas-mesias-tymoszczuk': {
    nombre: 'Tomás Mesías-Tymoszczuk',
    temas: ['Salud pública', 'Bioética', 'Derechos civiles'],
    presentacion:
      'Salud pública y bioética: cómo funcionan los sistemas de salud comparados, qué resolvió y qué rompió la ley de etiquetado, hasta dónde llega la ingeniería genética y quién queda afuera de la categoría de persona.',
    orden: 10,
  },
  'brian-mello': {
    nombre: 'Brian Mello',
    temas: ['Historia reciente', 'Política argentina', 'Mercados'],
    presentacion:
      'Cruza la historia argentina reciente con la coyuntura: del 19 de diciembre de 2001 a Malvinas y al fenómeno Milei, con desvíos hacia los mercados y hacia por qué la juventud debería meterse en política.',
    orden: 10,
  },
  'martina-angaroni': {
    nombre: 'Martina Angaroni',
    temas: ['Salud mental', 'Educación', 'Espacio público'],
    presentacion:
      'Trabaja con entrevistas a profesionales como método. Escribe sobre salud mental —sobre todo la que dejó la pandemia—, sobre qué significa ser estudiante hoy y sobre qué pasa cuando lo público se vuelve de alguien.',
    orden: 10,
  },
  'german-tamagno': {
    nombre: 'Germán Tamagno',
    temas: ['Derecho constitucional', 'Derechos humanos'],
    presentacion:
      'Derecho constitucional y derechos humanos, en formato de investigación: la evolución del Estado moderno, el debido proceso en la Convención Americana y el derecho a peticionar a las autoridades como llave de los demás derechos.',
    orden: 10,
  },
  'juan-ignacio-bossi': {
    nombre: 'Juan Ignacio Bossi',
    temas: ['Educación', 'Integración regional', 'Migraciones'],
    presentacion:
      'Educación, integración regional y migraciones: los treinta años del Mercosur, la escuela secundaria como el momento en que hay que decidir una vida, y los movimientos de población de América Latina, Asia y África hacia Europa.',
    orden: 10,
  },
  'leonardo-barreto': {
    nombre: 'Leonardo Barreto',
    temas: ['Ideas políticas', 'Liberalismo', 'América Latina'],
    presentacion:
      'Ideas políticas y economía desde una mirada liberal: qué hay detrás de la etiqueta "neoliberalismo", por qué reclama el derecho a portar armas y cómo lee la deriva argentina hacia el resto de la región.',
    orden: 10,
  },
  'pedro-enriquez': {
    nombre: 'Pedro Enríquez',
    temas: ['Geopolítica', 'Relaciones internacionales', 'Cultura'],
    presentacion:
      'Geopolítica y relaciones internacionales: el fin de la sociedad entre China y Estados Unidos, el pasado y el futuro de las dos Coreas, la crisis del Sahel y los asaltos a las instituciones en la región.',
    orden: 10,
  },
  'emanuel-hurtado': {
    nombre: 'Emanuel Hurtado',
    temas: ['Sociedad', 'Debate público'],
    presentacion:
      'Discute las convenciones que se dan por normales: lo políticamente correcto, la solidaridad cuando se vuelve gesto y todo aquello que se acepta sin preguntar demasiado.',
    orden: 50,
  },
  'agustin-primo': {
    nombre: 'Agustín Primo',
    temas: ['Libertad de expresión', 'Política argentina'],
    presentacion:
      'Libertad de expresión y los organismos que dicen regularla, con foco en cómo se define el discurso permitido en el debate público argentino.',
    orden: 50,
  },
  'camila-diaz-caneja': {
    nombre: 'Camila Díaz Caneja',
    temas: ['Tecnología y sociedad', 'Medios'],
    presentacion:
      'Escribe sobre vivir en un mundo hiperconectado y sobre el espectáculo como forma dominante de la conversación pública argentina.',
    orden: 50,
  },
  'felipe-rindertsma': {
    nombre: 'Felipe Rindertsma',
    temas: ['Universidad', 'Vida estudiantil'],
    presentacion:
      'La universidad por dentro: su debate político en Córdoba y su costado menos discutido, el de experiencia cultural antes que el de trámite académico.',
    orden: 50,
  },
  'martin-helmbrecht': {
    nombre: 'Martin Helmbrecht',
    temas: ['Economía', 'Impuestos', 'Inteligencia artificial'],
    presentacion:
      'Economía y tecnología aplicadas al mundo de la empresa: qué habría que cambiarle al sistema impositivo argentino y qué le abre y qué le rompe la inteligencia artificial a las compañías.',
    orden: 50,
  },
  'jazmin-gutierrez': {
    nombre: 'Jazmín Gutiérrez',
    temas: ['Género', 'Sociedad'],
    presentacion:
      'Escribe en primera persona sobre lo que significa ser mujer, y sobre las fechas que el país celebra sin animarse a mirarse del todo.',
    orden: 50,
  },
  'juan-eduardo-wehner': {
    nombre: 'Juan Eduardo Wehner',
    temas: ['Medios', 'Crónica'],
    presentacion:
      'Medios y crónica breve: la televisión que se apaga y el streaming que le toma el lugar, contados junto a las escenas mínimas de la vida de todos los días.',
    orden: 50,
  },
  'agustin-mino': {
    nombre: 'Agustín Miño',
    temas: ['Derecho', 'Activismo judicial'],
    presentacion:
      'Investigación jurídica sobre las prácticas activistas: los distintos modos de usar el derecho como herramienta de transformación y no sólo como norma.',
    orden: 50,
  },
  'santiago-ochoa': {
    nombre: 'Santiago Ochoa',
    temas: ['Derecho', 'Activismo judicial'],
    presentacion:
      'Investigación jurídica sobre las prácticas activistas: los distintos modos de usar el derecho como herramienta de transformación y no sólo como norma.',
    orden: 50,
  },
  'fabio-britez': {
    nombre: 'Fabio Britez',
    temas: ['Políticas públicas', 'Economía'],
    presentacion:
      'Diseño de políticas públicas y programas sociales, con una propuesta concreta: el ingreso básico universal descentralizado como salida al clientelismo.',
    orden: 50,
  },
  'felipe-srur': {
    nombre: 'Felipe Srur',
    temas: ['Geopolítica', 'Salud'],
    presentacion:
      'El cruce entre salud pública y geopolítica, con América Latina como punto de observación: quién produce las vacunas y quién espera por ellas.',
    orden: 50,
  },
  'jesus-fleitas': {
    nombre: 'Jesús Fleitas',
    temas: ['Privacidad', 'Tecnología', 'Estado'],
    presentacion:
      'Privacidad de los datos personales y el alcance de lo que el Estado sabe de cada ciudadano.',
    orden: 50,
  },
  'lautaro-sanchez': {
    nombre: 'Lautaro Sánchez',
    temas: ['Medios', 'Pandemia'],
    presentacion:
      'Medios y consumo cultural: cómo la pandemia aceleró una crisis de la televisión que ya venía en camino.',
    orden: 50,
  },
  'rafael-hofmann': {
    nombre: 'Rafael Hofmann',
    temas: ['América Latina', 'Política internacional'],
    presentacion:
      'Política internacional con foco en América Latina y en los regímenes que la región discute sin terminar de discutir.',
    orden: 50,
  },
  'nicolas-loza': {
    nombre: 'Nicolás Loza',
    temas: ['Mercados', 'Economía argentina'],
    presentacion:
      'Mercados de capitales: qué significó para la Argentina pasar de mercado emergente a standalone y qué mide realmente esa etiqueta.',
    orden: 50,
  },
  'bernardo-fassi': {
    nombre: 'Bernardo Fassi',
    temas: ['Libertades individuales', 'Pandemia'],
    presentacion:
      'La tensión entre las libertades individuales y las medidas sanitarias, escrita mientras la pandemia todavía definía el día a día.',
    orden: 50,
  },
  'leandro-andreu': {
    nombre: 'Leandro Andreu',
    temas: ['Políticas públicas', 'Ética'],
    presentacion:
      'Discute las políticas que se juzgan por sus intenciones y no por sus resultados.',
    orden: 50,
  },
  'cindy-damico': {
    nombre: 'Cindy D’Amico',
    temas: ['Derechos de las mujeres', 'Niñez'],
    presentacion:
      'Derechos de las niñas y de las mujeres, y lo que el lenguaje con que se habla de ellas deja ver.',
    orden: 50,
  },
  'enrique-guardo': {
    nombre: 'Enrique Guardo',
    temas: ['Historia argentina'],
    presentacion:
      'Historia argentina y las figuras que la memoria pública recuerda a medias, como Güemes.',
    orden: 50,
  },
  'tomas-perricone': {
    nombre: 'Tomás Perricone',
    temas: ['América Latina', 'Protesta social'],
    presentacion:
      'Cubre las crisis políticas de América Latina mientras están ocurriendo, como el estallido social colombiano.',
    orden: 50,
  },
  'redaccion-publius': {
    nombre: 'Redacción Publius',
    temas: ['Sin autoría registrada'],
    presentacion:
      'Notas publicadas por Publius Group cuya autoría no quedó registrada en el archivo del sitio original. Si reconocés alguna como propia, corregimos la firma.',
    orden: 99,
  },
};

/* ============================================================
   1. Fusionar las fichas duplicadas
   ============================================================ */
const fusionadas = [];
for (const [viejo, nuevo] of Object.entries(FUSIONES)) {
  const archivos = (await readdir(NOTAS)).filter((f) => f.endsWith('.md'));
  let movidas = 0;

  for (const archivo of archivos) {
    const ruta = join(NOTAS, archivo);
    const texto = await readFile(ruta, 'utf8');
    if (!new RegExp(`^autor: ${viejo}$`, 'm').test(texto)) continue;
    await writeFile(ruta, texto.replace(new RegExp(`^autor: ${viejo}$`, 'm'), `autor: ${nuevo}`), 'utf8');
    movidas++;
  }

  const fichaVieja = join(AUTORES, `${viejo}.md`);
  if (existsSync(fichaVieja)) await unlink(fichaVieja);
  fusionadas.push({ viejo, nuevo, movidas });
}

/* ============================================================
   2. Escribir todas las fichas
   ============================================================ */
const escritas = [];
for (const [slug, f] of Object.entries(FICHAS)) {
  const lineas = [
    '---',
    `nombre: "${f.nombre}"`,
    f.rol ? `rol: "${f.rol}"` : null,
    `temas: [${f.temas.map((t) => `"${t}"`).join(', ')}]`,
    `presentacion: "${f.presentacion.replace(/"/g, '\\"')}"`,
    `orden: ${f.orden}`,
    '---',
    '',
  ].filter((l) => l !== null);

  await writeFile(join(AUTORES, `${slug}.md`), lineas.join('\n'), 'utf8');
  escritas.push(slug);
}

/* ============================================================
   3. ¿Quedó alguna ficha sin datos, o algún autor sin ficha?
   ============================================================ */
const fichasEnDisco = (await readdir(AUTORES)).filter((f) => f.endsWith('.md')).map((f) => basename(f, '.md'));
const huerfanas = fichasEnDisco.filter((s) => !(s in FICHAS));

const autoresUsados = new Set();
for (const archivo of (await readdir(NOTAS)).filter((f) => f.endsWith('.md'))) {
  const texto = await readFile(join(NOTAS, archivo), 'utf8');
  const m = texto.match(/^autor: (.+)$/m);
  if (m) autoresUsados.add(m[1].trim());
  const co = texto.match(/^coautores: \[(.+)\]$/m);
  if (co) for (const c of co[1].split(',')) autoresUsados.add(c.trim().replace(/^"|"$/g, ''));
}
const sinFicha = [...autoresUsados].filter((s) => !fichasEnDisco.includes(s));

/* --- Informe --- */
console.log('');
for (const f of fusionadas) {
  console.log(`  Fusión: ${f.viejo} → ${f.nuevo}  (${f.movidas} notas reasignadas)`);
}
console.log(`\n  ${escritas.length} fichas escritas con presentación por temas.`);

if (huerfanas.length) {
  console.log(`\n  ✗ Fichas en disco sin datos en este script (${huerfanas.length}):`);
  for (const h of huerfanas) console.log(`      ${h}`);
  process.exitCode = 1;
}
if (sinFicha.length) {
  console.log(`\n  ✗ Autores usados en notas pero sin ficha (${sinFicha.length}):`);
  for (const s of sinFicha) console.log(`      ${s}`);
  process.exitCode = 1;
}
if (!huerfanas.length && !sinFicha.length) {
  console.log('  Todas las fichas tienen datos y todos los autores de las notas tienen ficha.');
}
console.log('');
