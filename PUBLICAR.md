# Publicar el sitio

El sitio está listo. Lo que falta son los pasos que pasan por tus cuentas: yo
no puedo entrar a GitHub, a Cloudflare ni a NIC.ar con tus credenciales. Cada
paso de acá lo hacés vos, en orden, con lo que va en cada campo.

Dominio: **publius.com.ar** — el original, recuperado.
Hosting: **Cloudflare Pages**.

> **Por qué Cloudflare Pages.** Es gratis, no tiene límite de tráfico —si una
> nota se vuelve viral no llega una factura— y sirve archivos estáticos, que es
> justo lo que genera Astro. Vercel y Netlify también servirían; la diferencia
> práctica es que sus planes gratuitos sí tienen tope de tráfico.

---

## Paso 0 — El control de prelanzamiento

```bash
npm run prelanzamiento
```

Compila, revisa que ningún enlace interno esté roto y controla la calidad de
las notas. **Si algo falla, no publiques: leé el error.** Hoy pasa limpio: 136
páginas y 3117 enlaces internos sin uno roto.

---

## Paso 1 — Subir el código a GitHub

El repositorio local ya está armado y con el primer commit hecho. Falta el
remoto.

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

---

## Paso 2 — Conectar Cloudflare Pages

1. Creá una cuenta en [dash.cloudflare.com](https://dash.cloudflare.com)
2. Menú de la izquierda: **Workers & Pages** → **Create** → pestaña **Pages**
   → **Connect to Git**
3. Autorizá a Cloudflare a ver tu GitHub y elegí `publius-web`
4. En la configuración del build, poné exactamente esto:

| Campo | Valor |
|---|---|
| Project name | `publius` |
| Production branch | `main` |
| Framework preset | `Astro` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | dejar vacío |

5. **Save and Deploy**

La primera compilación tarda uno a tres minutos. Después tenés el sitio andando
en `publius.pages.dev`.

**Abrilo y revisalo enterito antes de seguir.** Es mucho mejor encontrar un
problema acá que con el dominio ya apuntando. Mirá la portada, entrá a una
nota, probá el buscador de autores y dale play a un episodio.

---

## Paso 3 — Apuntar publius.com.ar

Esto tiene dos mitades: primero le decís a Cloudflare que el dominio es tuyo,
después le decís a NIC.ar que Cloudflare maneja el DNS.

### 3a. Agregar el dominio en Cloudflare

1. En el panel de Cloudflare, arriba: **Add a domain** (o **Add site**)
2. Escribí `publius.com.ar`
3. Elegí el plan **Free**
4. Cloudflare va a escanear el dominio y después te va a mostrar
   **dos nameservers** con esta forma:

```
algo.ns.cloudflare.com
otracosa.ns.cloudflare.com
```

**Copiá los dos que te muestre a vos.** No son fijos: cambian por cuenta.

### 3b. Cambiar la delegación en NIC.ar

1. Entrá a [nic.ar](https://nic.ar) con tu usuario (se ingresa con
   **Mi Argentina** o clave fiscal de AFIP)
2. Andá a tus dominios y elegí `publius.com.ar`
3. Buscá la sección de **delegación** — según la versión del panel puede
   llamarse "Delegar dominio", "Delegaciones" o "Servidores DNS"
4. Reemplazá los servidores que estén cargados por los dos de Cloudflare
5. Guardá los cambios

> Si el panel te pide los nameservers de a uno, o te pide también la IP,
> cargá sólo los nombres: Cloudflare los resuelve solo. Y si NIC.ar te avisa
> que los servidores "no responden para el dominio", esperá unos minutos y
> reintentá — a veces tarda en verificarlos.

### 3c. Conectar el dominio al sitio

De vuelta en Cloudflare: **Workers & Pages** → proyecto `publius` →
**Custom domains** → **Set up a custom domain** → `publius.com.ar`.

Agregá también **`www.publius.com.ar`** por separado. Sin eso, quien escriba
`www.` se come un error. Cloudflare lo redirige solo al dominio sin www.

### Qué pasa después

La delegación tarda **entre 15 minutos y 48 horas** en propagarse; los `.com.ar`
suelen tardar más que un `.com`. Cloudflare te manda un mail cuando lo detecta,
y ahí el certificado HTTPS se genera solo.

Mientras esperás, el sitio ya funciona en `publius.pages.dev`. No se rompe nada
durante la transición.

Para ver cómo va:

```bash
nslookup -type=NS publius.com.ar
```

Cuando devuelva los nameservers de Cloudflare, está listo.

---

## Paso 4 — Después de publicar

**Avisale a Google.** En
[Google Search Console](https://search.google.com/search-console) agregá
`publius.com.ar` y enviá el sitemap:
`https://publius.com.ar/sitemap-index.xml`. Tiene las 135 páginas. Sin esto el
sitio tarda semanas en aparecer en búsquedas; con esto, días.

**Google todavía tiene el sitio viejo indexado**, con las notas en la raíz
(`publius.com.ar/chocobar-sera-justicia/`). Eso ya está resuelto: las
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

Una vez conectado, **cada `git push` a `main` republica el sitio solo**. No hay
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

- **Los links del sitio viejo funcionan.** `public/_redirects` manda las 94
  notas de la raíz a `/notas/`, y las páginas de autor, categoría y tag a su
  lugar nuevo.
- **HTTPS** lo pone Cloudflare, gratis y renovado solo.
- **Versión de Node** fijada en `.node-version`, así el build en Cloudflare usa
  la misma que tu máquina.
- **Página 404** propia, con las últimas notas para que quien caiga ahí tenga
  algo para leer.
- **`robots.txt` y sitemap** con el dominio correcto.
- **Cabeceras de seguridad** en `public/_headers`, más cache larga para los
  archivos con hash en el nombre.
- **Open Graph** en todas las páginas: al compartir un link sale con título,
  bajada e imagen.

---

## Si algo sale mal

**La compilación falla en Cloudflare pero anda en tu máquina.** Casi siempre es
Node. Ya está fijado en `.node-version`, pero si igual falla:
**Settings** → **Environment variables** → `NODE_VERSION` = `22`.

**El dominio no resuelve después de 48 horas.** Verificá en NIC.ar que la
delegación quedó guardada; a veces el panel pide confirmar dos veces.

**Cambiás el dominio.** Dos lugares: `site` en `astro.config.mjs` y `DOMINIO`
en `src/lib/enlaces.ts`, más la línea del sitemap en `public/robots.txt`.
Después `npm run build`.
