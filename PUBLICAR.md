# Publicar el sitio

**El sitio ya está publicado.** Falta un solo paso: apuntar el dominio.

| | |
|---|---|
| En línea ahora | **https://publius-flax.vercel.app** |
| Repositorio | `santiicipolletta/publius-web` (privado) |
| Proyecto en Vercel | `publius`, cuenta `santiagocipolletta@gmail.com` |
| Dominio a conectar | **publius.com.ar** |

Lo que ya funciona, verificado sobre el sitio publicado: las 136 páginas, las
106 redirecciones del sitio viejo, las cabeceras de seguridad, la cache de los
assets y el HTTPS.

---

## Lo único que falta: el dominio

Son dos mitades, y las dos pasan por paneles con tus credenciales. Yo no puedo
hacerlas: el conector de Vercel sirve para comprar dominios nuevos, pero no
tiene ninguna herramienta para asociar uno que ya tenés a un proyecto.

### 1. Agregar el dominio en Vercel

1. Entrá a [vercel.com](https://vercel.com) con la cuenta de Santiago
2. Proyecto **publius** → **Settings** → **Domains**
3. Escribí `publius.com.ar` y **Add**
4. Agregá también `www.publius.com.ar` por separado

Vercel te va a mostrar los registros DNS que espera. Según la documentación
oficial son estos:

| Registro | Nombre | Valor |
|---|---|---|
| `A` | `@` (la raíz) | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns-0.com` |

**Usá los que muestre el panel**, no estos, por si cambiaron.

### 2. Cargar el DNS en NIC.ar

Entrá a [nic.ar](https://nic.ar) — se ingresa con **Mi Argentina** o clave
fiscal de AFIP — y elegí `publius.com.ar`. Ahí tenés dos caminos:

**Si NIC.ar te deja editar registros** (el "Servicio de DNS" propio de NIC.ar):
cargá el registro `A` y el `CNAME` de la tabla de arriba. Es el camino más
simple y no cambia nada más.

**Si sólo te deja delegar a servidores externos:** ese panel pide
*nameservers*, no registros. En ese caso, en Vercel elegí la opción de usar
**Vercel DNS** para el dominio: te va a dar dos nameservers, y esos son los que
cargás como delegación en NIC.ar.

> Si NIC.ar avisa que los servidores "no responden para el dominio", esperá
> unos minutos y reintentá: tarda en verificarlos.

### Qué pasa después

Propaga en **entre 15 minutos y 48 horas**; los `.com.ar` suelen tardar más que
un `.com`. El certificado HTTPS se genera solo cuando Vercel detecta el
dominio. Mientras esperás, el sitio sigue andando en la URL de `vercel.app`:
no hay ventana de caída.

```bash
nslookup publius.com.ar
```

Cuando devuelva `76.76.21.21` —o los nameservers de Vercel, según el camino que
hayas usado— está listo.

---

## El control de prelanzamiento

Antes de cada push:

```bash
npm run prelanzamiento
```

Compila, revisa que ningún enlace interno esté roto y controla la calidad de
las notas. **Si falla, no pushees: leé el error.** Hoy pasa limpio: 136 páginas
y 3117 enlaces internos sin uno roto.

---

## Paso 4 — Después de publicar

**Avisale a Google.** En
[Google Search Console](https://search.google.com/search-console) agregá
`publius.com.ar` y enviá el sitemap:
`https://publius.com.ar/sitemap-index.xml`. Tiene las 135 páginas.

**Google todavía tiene el sitio viejo indexado**, con las notas en la raíz
(`publius.com.ar/chocobar-sera-justicia/`). Eso ya está resuelto: las 106
redirecciones mandan cada una a su lugar nuevo, así que el posicionamiento que
tenía el medio no se pierde. Es la ventaja concreta de haber recuperado este
dominio y no otro.

**Revisá los links en las plataformas activas.** Ahora que el dominio vuelve a
funcionar, verificá que apunten bien:

- El canal de YouTube, en la descripción
- El programa en Spotify for Podcasters — el feed declara `publius.com.ar`
- Instagram (`@publius_group`), en la bio
- Apple Podcasts toma el dato del feed, así que se arregla solo

---

## De ahí en adelante: publicar una nota

Una vez vinculado, **cada `git push` a `main` republica el sitio solo**. No hay
que entrar a ningún panel.

```bash
# escribís la nota en src/content/notas/mi-nota.md
npm run prelanzamiento
git add -A
git commit -m "Nota nueva: título de la nota"
git push
```

Dos o tres minutos después está publicada.

---

## Lo que ya está resuelto y no hay que configurar

- **Los links del sitio viejo funcionan.** Las 106 redirecciones están
  generadas **en los dos formatos**: `vercel.json` (que es el que Vercel lee) y
  `public/_redirects` (Cloudflare y Netlify). Salen de la misma fuente con
  `npm run redirecciones`, que corre solo en cada build. Mudarse de hosting no
  rompe nada.
- **HTTPS** lo pone Vercel, gratis y renovado solo.
- **Versión de Node** fijada en `.node-version`, así el build del hosting usa
  la misma que tu máquina.
- **Página 404** propia, con las últimas notas para que quien caiga ahí tenga
  algo para leer.
- **`robots.txt` y sitemap** con el dominio correcto.
- **Cabeceras de seguridad** y cache larga para los archivos con hash en el
  nombre, también en los dos formatos.
- **Open Graph** en todas las páginas: al compartir un link sale con título,
  bajada e imagen.

---

## Pendiente, sin urgencia

**La imagen de Open Graph pesa 796 KB y mide 1920×1080.** Para Open Graph la
medida correcta es 1200×630, y ese peso hace que WhatsApp tarde en mostrar la
previsualización al compartir una nota. Se arregla agregando `sharp` y un
script de una pasada.

**Las 65 notas que tenían imagen propia** siguen con placeholder de la marca.

---

## Si algo sale mal

**La compilación falla en Vercel pero anda en tu máquina.** Casi siempre es
Node. Ya está fijado en `.node-version`, pero si igual falla:
**Settings** → **Environment Variables** → `NODE_VERSION` = `22`.

**El dominio no resuelve después de 48 horas.** Verificá en NIC.ar que la
delegación quedó guardada; a veces el panel pide confirmar dos veces.

**Cambiás el dominio.** Dos lugares: `site` en `astro.config.mjs` y `DOMINIO`
en `src/lib/enlaces.ts`, más la línea del sitemap en `public/robots.txt`.
Después `npm run build`.
