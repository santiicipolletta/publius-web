# Publius Group — sitio web

Sitio de [Publius Group](https://publius.com.ar), *los medios de la nueva generación*.

Hecho con [Astro](https://astro.build): el sitio se genera como HTML estático.
No hay base de datos ni plugins que se rompan, y **todas las notas son archivos
de texto dentro de este repositorio**. Si mañana se cae el hosting, se muda en
diez minutos sin perder nada. Eso es justamente lo que falló la vez anterior.

---

## Cómo levantarlo

```bash
npm install       # solo la primera vez
npm run dev       # abre http://localhost:4321
```

Mientras `npm run dev` corre, cada vez que guardás un archivo el navegador se
actualiza solo.

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:4321 |
| `npm run build` | Genera el sitio final en `dist/`. **Si esto falla, algo está mal: leé el error.** |
| `npm run preview` | Sirve lo que generó `build`, igual a como se verá publicado |
| `npm run verificar` | Revisa el contenido sin compilar |
| `npm run placeholders` | Regenera las imágenes de relleno de la marca |

---

## Dónde está cada cosa

```
web/
├── src/
│   ├── content/
│   │   ├── notas/          ← LAS NOTAS. Un archivo .md por nota.
│   │   └── autores/        ← LOS AUTORES. Un archivo .md por persona.
│   │
│   ├── content.config.ts   ← Define qué datos lleva una nota y un autor.
│   │                          Acá se agregan categorías nuevas.
│   │
│   ├── pages/              ← Cada archivo acá es una URL del sitio.
│   │   ├── index.astro             →  /
│   │   ├── notas/index.astro       →  /notas
│   │   ├── notas/[...slug].astro   →  /notas/cualquier-nota
│   │   ├── autores/index.astro     →  /autores
│   │   ├── autores/[slug].astro    →  /autores/cualquier-persona
│   │   ├── categoria/[slug].astro  →  /categoria/opinion
│   │   ├── podcast.astro           →  /podcast
│   │   └── rss.xml.ts              →  /rss.xml
│   │
│   ├── layouts/Base.astro  ← El "molde" común: <head>, header, footer.
│   ├── components/
│   │   ├── Header.astro        ← Logotipo + navegación
│   │   ├── Footer.astro
│   │   ├── NotaCard.astro      ← La tarjeta de nota de las grillas
│   │   └── CtaMultimedia.astro ← Los botones de YouTube y Spotify
│   │
│   ├── styles/global.css   ← Colores y tipografías de la marca. Empezá acá.
│   └── lib/                ← Funciones auxiliares (fechas, orden, imágenes).
│
├── public/
│   ├── marca/              ← Logos
│   └── placeholders/       ← Imágenes de relleno generadas (ver más abajo)
│
├── scripts/
│   ├── verificar.mjs            ← Chequea el contenido antes de compilar
│   ├── docx-texto.sh            ← Saca el texto de un .docx
│   └── generar-placeholders.mjs ← Genera las imágenes de relleno
│
└── astro.config.mjs        ← Config del proyecto (dominio, sitemap).
```

Los corchetes en `[slug].astro` significan "esta página se repite una vez por
cada nota/autor/categoría". Astro las genera todas solas.

---

## Cómo publicar una nota

Creá un archivo en `src/content/notas/`. **El nombre del archivo es la URL.**

`src/content/notas/la-juventud-y-la-politica.md` → `/notas/la-juventud-y-la-politica`

Usá minúsculas, guiones en vez de espacios, y sin acentos ni eñes en el nombre
del archivo.

```markdown
---
titulo: "La juventud y la política"
extracto: "Una mirada profunda sobre la importancia de involucrarse en cuestiones políticas como jóvenes."
autor: brian-mello
fecha: 2022-09-20
categorias: ["Opinión"]
tags: ["política", "juventud"]
---

Acá va el texto de la nota, en párrafos normales.

Una línea en blanco separa un párrafo del siguiente. Para poner algo en
**negrita** se usan dos asteriscos, y para *itálica* uno solo.

## Un subtítulo

> Una cita textual va con un signo mayor adelante.

Y un [link se escribe así](https://publius.com.ar).
```

Lo que va entre los `---` de arriba se llama **frontmatter**: son los datos de
la nota. Los campos disponibles:

| Campo | ¿Obligatorio? | Qué es |
|---|---|---|
| `titulo` | sí | El título de la nota |
| `extracto` | sí | La bajada. Se ve en el home y al compartir el link |
| `autor` | sí | El **nombre del archivo** del autor, sin `.md` |
| `fecha` | sí | `AAAA-MM-DD` |
| `categorias` | sí | Una o más: `Actualidad`, `Opinión`, `Investigación`, `Guerra`, `Shorts` |
| `tags` | no | Palabras clave libres |
| `imagen` | no | Ruta dentro de `public/`, por ejemplo `/imagenes/mi-foto.jpg`. Si se deja vacío, la nota recibe un placeholder de la marca |
| `imagenAlt` | no | Descripción de la imagen para lectores de pantalla |
| `destacada` | no | `true` la pone grande arriba del home |
| `borrador` | no | `true` la deja fuera del sitio publicado |
| `fuenteOriginal` | no | Link al archivo del sitio viejo, para las notas rescatadas |

> **El contenido se valida antes de compilar.** `npm run build` corre primero
> `scripts/verificar.mjs`, que corta el build y explica el problema si una nota
> apunta a un autor que no existe, usa una categoría inventada, tiene una fecha
> imposible o un nombre de archivo que no sirve como URL.
>
> Podés correrlo solo, sin compilar, con `npm run verificar`.
>
> Existe porque Astro, por su cuenta, avisa del autor inexistente pero **termina
> de compilar igual** y publica la nota sin firma. Con casi cien notas ese aviso
> se pierde entre el resto de la salida.

### Si la nota está en Word

```bash
./scripts/docx-texto.sh "ruta/a/la/nota.docx"
```

Eso imprime el texto en párrafos listos para pegar debajo del frontmatter.

---

## Cómo agregar un autor

Creá `src/content/autores/nombre-apellido.md`:

```markdown
---
nombre: "Brian Mello"
temas: ["Historia reciente", "Política argentina", "Mercados"]
presentacion: "Cruza la historia argentina reciente con la coyuntura: del 19 de diciembre de 2001 a Malvinas y al fenómeno Milei."
instagram: "brianmello"
orden: 10
---
```

| Campo | ¿Obligatorio? | Qué es |
|---|---|---|
| `nombre` | sí | Como quiere que se lo lea |
| `temas` | sí | Dos a cuatro etiquetas cortas. Se muestran en su ficha **y el buscador de autores busca acá dentro** |
| `presentacion` | sí | **De qué escribe, no quién es.** Ver abajo |
| `rol` | no | Sólo para quien tiene una función editorial además de escribir |
| `orden` | no | Posición en `/autores`: 1 dirección, 10 firmas sostenidas, 50 el resto |

La página del autor con todas sus notas **se arma sola**. No hay que tocar nada más.

### Cómo se escribe la presentación

No es una biografía. No van la edad, ni la ciudad, ni el título universitario.
Va **sobre qué escribe esta persona**, mirando sus notas reales.

> Mal: *"Tiene 24 años, vive en Córdoba y estudia Abogacía."*
>
> Bien: *"Derecho constitucional y derechos humanos, en formato de
> investigación: la evolución del Estado moderno, el debido proceso en la
> Convención Americana y el derecho a peticionar a las autoridades como llave
> de los demás derechos."*

La forma de escribirla es abrir sus notas, ver de qué hablan, y contarlo. Dos o
tres líneas. Si nombrás los temas concretos que toca, el lector sabe en treinta
segundos si le interesa leerla.

### Todas las firmas son autores

**No existe la categoría de "invitado".** Quien publicó una sola nota tiene
ficha y página propia igual que quien publicó veintinueve. La razón es
práctica: así se lo encuentra escribiendo su nombre en `/autores`.

Las notas escritas entre varias personas usan `coautores`, y aparecen en la
página de cada una:

```yaml
autor: agustin-mino
coautores: [santiago-ochoa, german-tamagno]
```

### El buscador de autores

`/autores` tiene un buscador que filtra en el navegador, sin pedidos al
servidor. Busca por **nombre y por tema** a la vez, ignora los acentos y las
mayúsculas —`jazmin` encuentra a Jazmín Gutiérrez— y con varias palabras exige
todas: `derecho constitucional` filtra más que `derecho`. Con `Escape` se
limpia, y `/autores?q=salud` entra con la búsqueda hecha.

---

## La marca

Los estilos se escriben con **Tailwind CSS**, y todos los colores y medidas
salen de un solo lugar: el bloque `@theme` de `src/styles/global.css`. Cambiás
un valor ahí y cambia en todo el sitio.

### La paleta, en orden de dominancia

| | Color | Hex | Uso | Contraste |
|---|---|---|---|---|
| 1 | Blanco | `#FFFFFF` | Tarjetas | — |
| 1 | Gris de fondo | `#F7F8FA` | Fondo de todo el cuerpo | — |
| 2 | Navy | `#091528` | Cabecera, pie y acentos menores | 18.3:1 |
| 3 | Rojo oscuro | `#8A1017` | **Sólo** CTAs de YouTube | 9.7:1 |
| 3 | Verde oscuro | `#0E4429` | **Sólo** CTAs de Spotify y podcast | 11.2:1 |

Texto: `#14213A` para títulos y cuerpo, `#55606F` para bajadas, `#6A7280` para
metadatos. Los tres pasan AA (4.5:1) sobre blanco y sobre el gris del fondo.

> **La regla del rojo y el verde.** Son los dos únicos colores reservados: si
> aparecen en la página, es porque ese elemento lleva a un video o a un
> podcast. No se usan para nada más — ni para categorías, ni para errores, ni
> para destacar texto. Están concentrados en el componente
> `CtaMultimedia.astro`, así que la regla se cumple sola.

### Tipografía

**Poppins** en todo: geométrica y moderna, es la que más se acerca a la del
logotipo. El peso 300 es el "Group" del logo; el 800, los rótulos de categoría.

El logotipo de la cabecera no es una imagen: es texto con dos pesos distintos
(`Publius` en 700, `Group` en 300). Queda nítido en cualquier pantalla, se
puede seleccionar y pesa cero.

### Imágenes

Las notas sin imagen propia reciben uno de los seis placeholders de
`public/placeholders/`: SVG abstractos en los colores de la marca, con motivos
de tono corporativo. Pesan menos de 2 KB cada uno y no dependen de ningún
servicio externo.

El reparto se calcula a partir del nombre del archivo de la nota, así que cada
nota recibe siempre el mismo y el home no cambia de aspecto entre una
compilación y la siguiente. Para poner una imagen real, va en `public/` y se
declara en el campo `imagen`.

### La disposición del home

Está tomada de la sección *New Articles* de [uxmag.com](https://uxmag.com), con
las medidas medidas sobre el sitio real:

| | Referencia | Publius |
|---|---|---|
| Contenedor | 1280 px | 1280 px |
| Nota destacada | 844 / 380 (69/31) | 833 / 374 |
| Grilla | 4 columnas, gap 12 px | 4 columnas, gap 12 px |
| Padding de tarjeta | 22 / 22 / 20 px | 22 / 22 / 20 px |
| Esquinas | 0 px | 0 px |

Las esquinas rectas no son un detalle menor: son lo que separa el aire
editorial del aspecto de plantilla.

---

## Reglas de la casa

1. **Nunca subir datos personales.** `Redes/Web/Lista publius.xlsx` tiene
   mails y teléfonos del equipo. Ya está excluido en `.gitignore` — que siga así.
2. **Nunca subir credenciales.** Si algún día hace falta una clave de API, va en
   un archivo `.env` (también excluido), nunca dentro del código.
3. **Antes de publicar, `npm run build`.** Si compila, no se rompió nada.

---

## El rescate del archivo

El sitio original era WordPress y se cayó, pero el Wayback Machine lo había
archivado completo. Las 92 notas publicadas se recuperaron de ahí, con su
autor, fecha, categorías y tags originales.

El rescate son cuatro etapas separadas, para poder repetir cualquiera sin
volver a empezar:

| Comando | Qué hace |
|---|---|
| `npm run rescate:listar` | Consulta la CDX API del Wayback y separa las notas de los índices, taxonomías y archivos internos |
| `npm run rescate:bajar` | Baja el HTML de cada nota a `scripts/rescate/cache/`. Va de a una, con pausa. Si se corta, volvé a correrlo: sigue donde quedó |
| `npm run rescate:convertir` | Convierte la caché a Markdown. Agregá `--sobreescribir` para regenerar, o `--solo <slug>` para una sola |
| `npm run rescate:revisar` | Control de calidad: busca restos de HTML, entidades sin decodificar, enlaces muertos y firmas duplicadas |

**De dónde sale cada dato:** el título, la fecha y el autor salen del JSON-LD
que dejaba el plugin de SEO. Las categorías y los tags salen de las clases del
`<article>` (`category-opinion`, `tag-chocobar`), que los traen separados. El
cuerpo sale del `div.entry-content`. La bajada se arma con el primer párrafo.

**Por qué el énfasis quedó como HTML.** En las notas vas a ver `<strong>` y
`<em>` en lugar de asteriscos. Es deliberado. Los asteriscos de Markdown tienen
reglas estrictas sobre dónde pueden abrir y cerrar —no valen pegados a
puntuación, ni cruzando un corte de párrafo— y el editor de WordPress generaba
exactamente esos casos. El resultado eran asteriscos crudos a la vista del
lector. Markdown acepta HTML en línea, así que conservarlo elimina el problema
de raíz. Si escribís una nota nueva, usá asteriscos normalmente.

**Lo que el rescate no puede devolver:** las imágenes. Vivían en
`publius.com.ar/wp-content/`, que ya no responde. 65 notas tenían imagen propia
y hoy usan un placeholder de la marca.

## El podcast

`/podcast` tiene los dos ciclos con **los 212 episodios y su audio**: se
escuchan sin salir del sitio.

| | Episodios | Audio | Período |
|---|---|---|---|
| Primera Parada | 194 | 18 h | feb 2021 – sep 2022 |
| Fuera de Contexto | 18 | 8 h | feb 2021 – abr 2022 |

```bash
npm run podcast:feed
```

Eso baja el feed y escribe `src/data/episodios.json`. **El sitio se compila
contra ese archivo, no contra internet**, por las mismas razones que todo lo
demás: si Anchor se cae o cambia, el sitio sigue funcionando igual. Cuando
publiquen un episodio nuevo, se corre el comando y se recompila.

La URL del feed **no está escrita a mano en ningún lado**: el script la pide a
la API de Apple a partir del ID del programa. Si algún día migran de Anchor a
otra plataforma, el script sigue encontrando el feed correcto.

**Cómo se reparten los episodios entre los ciclos.** Por el título, con dos
casos especiales que estaban en el feed real: un episodio dice *"Primera
Prada"* (con el typo) y el *"Piloto"* no nombra su ciclo pero pertenece a Fuera
de Contexto. Los dos están contemplados en `scripts/podcast/bajar-feed.mjs`, y
el script **falla si algún episodio no cae en ningún ciclo** — así un título
nuevo con otro formato no se pierde en silencio.

**Los reproductores.** Son `<audio>` nativo del navegador, no un iframe de
Spotify. Cargan con `preload="none"` y dentro de un `<details>`, así que una
página con 194 episodios no hace 194 pedidos: el audio se pide recién cuando
abrís ese episodio. Los archivos siguen alojados en el CDN de Spotify y
responden a pedidos por rango, así que se puede adelantar y retroceder.

Primera Parada se agrupa **por mes** —son 194 episodios de un diario— con el
mes más reciente abierto y el resto plegado. Fuera de Contexto va de corrido
con la descripción a la vista, porque son 18 entrevistas temáticas.

## Estado y qué sigue

- [x] Estructura del sitio: home, notas, autores, categorías, podcast, RSS, sitemap
- [x] Identidad visual sobre los logos oficiales
- [x] Portada rediseñada: foco en el logotipo, grilla editorial, paleta clara
- [x] **94 notas rescatadas** (92 del archivo del sitio + 2 inéditas de los `.docx`)
- [x] **30 autores**, todos con ficha propia y presentación por temas
- [x] Buscador de autores por nombre y por tema
- [x] **Podcast: 212 episodios** con audio, armados desde el feed
- [ ] Sección de video (YouTube: Primera Parada y Fuera de Contexto)
- [ ] Imágenes reales en las 65 notas que las tenían
- [ ] Recuperar el dominio `publius.com.ar`
- [ ] Deploy
- [ ] Panel de carga para que los autores escriban sin tocar código
