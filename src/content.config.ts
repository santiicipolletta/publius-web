import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* Las categorías que usaba el sitio original.
   Si más adelante querés agregar una, se agrega acá y nada más. */
export const CATEGORIAS = [
  'Actualidad',
  'Opinión',
  'Investigación',
  'Guerra',
  'Shorts',
] as const;

/* --- NOTAS ---------------------------------------------------
   Cada archivo .md dentro de src/content/notas/ es una nota.
   El nombre del archivo es la URL: "la-escuela-y-la-profesion.md"
   se publica en /notas/la-escuela-y-la-profesion
   ------------------------------------------------------------ */
const notas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notas' }),
  schema: () =>
    z.object({
      titulo: z.string(),
      /* Bajada que se muestra en el home y en redes */
      extracto: z.string(),
      /* Apunta a un archivo de src/content/autores/ — Astro valida
         que exista, así no quedan notas con autores fantasma */
      autor: reference('autores'),
      /* Notas escritas entre varias personas. El primer nombre va en
         "autor" y el resto acá, también como referencias validadas. */
      coautores: z.array(reference('autores')).default([]),
      fecha: z.coerce.date(),
      categorias: z.array(z.enum(CATEGORIAS)).min(1),
      tags: z.array(z.string()).default([]),
      /* Ruta dentro de public/ — por ejemplo "/imagenes/mi-foto.jpg".
         Si se deja vacío, la nota recibe un placeholder de la marca. */
      imagen: z.string().optional(),
      imagenAlt: z.string().optional(),
      destacada: z.boolean().default(false),
      /* Las notas en borrador no se publican */
      borrador: z.boolean().default(false),
      /* Para las notas rescatadas: de dónde salió el texto */
      fuenteOriginal: z.string().url().optional(),
    }),
});

/* --- AUTORES -------------------------------------------------
   Un archivo por persona. Todas las firmas son autores: no hay
   categoría de "invitado". Así cualquiera se encuentra buscando
   su nombre en /autores.
   ------------------------------------------------------------ */
const autores = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/autores' }),
  schema: () =>
    z.object({
      nombre: z.string(),
      /* Sólo para quien tiene una función editorial además de escribir */
      rol: z.string().optional(),
      /* Los temas que efectivamente toca en sus notas. Se muestran como
         etiquetas y el buscador de autores también busca acá dentro. */
      temas: z.array(z.string()).min(1),
      /* De qué escribe, no quién es: dos o tres líneas sobre los temas
         que aparecen en sus notas, no datos personales. */
      presentacion: z.string(),
      /* Ruta dentro de public/ — por ejemplo "/autores/martina.jpg" */
      foto: z.string().optional(),
      /* Redes opcionales */
      instagram: z.string().optional(),
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
      /* Para ordenar el equipo en /autores */
      orden: z.number().default(100),
    }),
});

export const collections = { notas, autores };
