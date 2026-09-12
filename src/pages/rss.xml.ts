import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getEntry } from 'astro:content';
import { notasPublicadas } from '../lib/notas';

export async function GET(context: APIContext) {
  const notas = await notasPublicadas();

  const items = await Promise.all(
    notas.map(async (nota) => {
      const autor = await getEntry(nota.data.autor);
      return {
        title: nota.data.titulo,
        description: nota.data.extracto,
        pubDate: nota.data.fecha,
        link: `/notas/${nota.id}/`,
        author: autor?.data.nombre,
        categories: nota.data.categorias,
      };
    }),
  );

  return rss({
    title: 'Publius Group',
    description: 'Los medios de la nueva generación.',
    site: context.site!,
    items,
    customData: '<language>es-AR</language>',
  });
}
