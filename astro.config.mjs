// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // El dominio del sitio. Se usa para el sitemap, el RSS y las
  // etiquetas canónicas y de Open Graph de cada página.
  // Si algún día se recupera publius.com.ar, se cambia acá y nada más.
  site: 'https://publiusgroup.com',

  integrations: [sitemap()],

  markdown: {
    shikiConfig: { theme: 'github-light', wrap: true },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});