# Publicar el sitio

Dominio: **publius.com.ar** — el original, recuperado.
Hosting: **Vercel**, en la cuenta `santiagocipolletta@gmail.com` (la que está
conectada acá).

El reparto de tareas es este, y viene de una limitación concreta:

| Tarea | Quién |
|---|---|
| Crear el repositorio en GitHub y pushear | **Vos** |
| Crear el proyecto en Vercel y vincularlo | Yo |
| Desplegar | Yo |
| Agregar el dominio en Vercel | Yo |
| Delegar el dominio en NIC.ar | **Vos** |

Lo de GitHub y lo de NIC.ar pasa por tus credenciales: no tengo —ni debería
tener— forma de entrar a esas cuentas.

---

## Paso 0 — El control de prelanzamiento

```bash
npm run prelanzamiento
```

Compila, revisa que ningún enlace interno esté roto y controla la calidad de
las notas. **Si algo falla, no publiques: leé el error.** Hoy pasa limpio: 136
páginas y 3117 enlaces internos sin uno roto.

---

## Paso 1 — El repositorio en GitHub (tuyo)

El repositorio local ya está armado, con tres commits. Falta el remoto.

1. Entrá a [github.com/new](https://github.com/new)
2. **Repository name:** `publius-web`
3. Público o privado, cualquiera sirve. Privado es razonable: el sitio va a ser
   público igual, pero el código no tiene por qué serlo.
4. **No marques** "Add a README", "Add .gitignore" ni "Choose a license": ya
   están en el repo y chocarían.
5. Creá el repositorio y después, en esta carpeta:

```bash
git remote add origin https://github.com/TU-USUARIO/publius-web.git
git push -u origin main
```

Cambiá `TU-USUARIO` por el tuyo. Si te pide contraseña, GitHub ya no las
acepta: instalá [GitHub CLI](https://cli.github.com) y corré `gh auth login`
una vez, o generá un *personal access token*.

**Cuando termines, pasame `TU-USUARIO/publius-web`** y sigo yo.

> Si conectás el MCP de GitHub, avisame y verifico si me da acceso: en ese caso
> el repositorio lo puedo crear y pushear yo, y este paso desaparece.

---

## Paso 2 — Vercel (lo hago yo)

Con el repo existiendo, yo ejecuto la vinculación y el deploy. Vas a recibir
una URL de `vercel.app` para revisar.

**Revisá esa URL enterita antes de tocar el DNS.** Portada, una nota, el
buscador de autores y darle play a un episodio. Encontrar un problema ahí es
gratis; encontrarlo con el dominio ya apuntando, no.

---

## Paso 3 — Apuntar publius.com.ar (tuyo)

Cuando confirmes que la URL de Vercel está bien, yo agrego el dominio al
proyecto. Vercel te va a pedir una de dos cosas; con un `.com.ar` en NIC.ar,
la que sirve es la **delegación a los nameservers de Vercel**.

1. Yo te paso los dos nameservers exactos que muestre Vercel. Tienen esta
   forma:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

2. Entrá a [nic.ar](https://nic.ar) con tu usuario (se ingresa con
   **Mi Argentina** o clave fiscal de AFIP)
3. Andá a tus dominios y elegí `publius.com.ar`
4. Buscá la sección de **delegación** — según la versión del panel puede
   llamarse "Delegar dominio", "Delegaciones" o "Servidores DNS"
5. Reemplazá los servidores cargados por los dos de Vercel
6. Guardá

> Si NIC.ar te avisa que los servidores "no responden para el dominio",
> esperá unos minutos y reintentá: tarda en verificarlos.

### Qué pasa después

La delegación tarda **entre 15 minutos y 48 horas** en propagarse; los
`.com.ar` suelen tardar más que un `.com`. El certificado HTTPS se genera solo
cuando Vercel detecta el dominio.

Mientras esperás, el sitio ya funciona en la URL de `vercel.app`. No se rompe
nada durante la transición.

```bash
nslookup -type=NS publius.com.ar
```

Cuando devuelva los nameservers de Vercel, está listo.

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
