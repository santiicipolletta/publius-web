/**
 * Los enlaces externos del medio, en un solo lugar.
 *
 * Están acá y no repartidos por los componentes por una razón
 * concreta: hasta que se centralizaron, el enlace de YouTube y el de
 * Spotify estaban mal copiados en cinco archivos cada uno, y había que
 * corregirlos de a uno. Ahora se cambian una vez.
 *
 * Si cambia una cuenta o se suma una plataforma, es el único archivo
 * que hay que tocar.
 */

export const ENLACES = {
  youtube: 'https://www.youtube.com/@publiusgroup9273',
  spotify: 'https://open.spotify.com/show/36fbCxHKnpDATh6D2WygYq',
  applePodcasts: 'https://podcasts.apple.com/us/podcast/publius-group/id1553800644',
  instagram: 'https://www.instagram.com/publius_group/',
} as const;

/** El dominio del sitio. Tiene que coincidir con `site` en astro.config.mjs */
export const DOMINIO = 'https://publius.com.ar';
