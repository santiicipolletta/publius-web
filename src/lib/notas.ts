import { getCollection, type CollectionEntry } from 'astro:content';

/* "Investigación" -> "investigacion" (para las URLs de categoría) */
export function slugCategoria(categoria: string): string {
  return categoria
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

/* Todas las notas publicadas, de la más nueva a la más vieja.
   Las que tienen borrador: true quedan afuera del sitio. */
export async function notasPublicadas(): Promise<CollectionEntry<'notas'>[]> {
  const todas = await getCollection('notas', ({ data }) => !data.borrador);
  return todas.sort((a, b) => b.data.fecha.valueOf() - a.data.fecha.valueOf());
}

/* --- Imagen destacada ---------------------------------------
   Si la nota no trae imagen propia, se le asigna uno de los
   placeholders de la marca. El reparto se calcula a partir del
   slug, así que una nota siempre recibe el mismo: el home no
   cambia de aspecto entre una compilación y la siguiente. */
const PLACEHOLDERS = [
  '/placeholders/instituciones.svg',
  '/placeholders/analisis.svg',
  '/placeholders/redes.svg',
  '/placeholders/datos.svg',
  '/placeholders/debate.svg',
  '/placeholders/archivo.svg',
] as const;

export function imagenDe(nota: CollectionEntry<'notas'>): string {
  if (nota.data.imagen) return nota.data.imagen;

  /* Suma de los códigos del slug → índice estable */
  let suma = 0;
  for (let i = 0; i < nota.id.length; i++) suma += nota.id.charCodeAt(i);
  return PLACEHOLDERS[suma % PLACEHOLDERS.length];
}

export function altDe(nota: CollectionEntry<'notas'>): string {
  /* Los placeholders son decorativos: alt vacío para que los
     lectores de pantalla no anuncien una imagen sin información. */
  if (!nota.data.imagen) return '';
  return nota.data.imagenAlt ?? nota.data.titulo;
}

/* Las notas de una persona, para su página de autor.
   Incluye las que co-escribió: si alguien figura como coautor, la
   nota también es suya y tiene que aparecer en su página. */
export async function notasDe(slugAutor: string): Promise<CollectionEntry<'notas'>[]> {
  const todas = await notasPublicadas();
  return todas.filter(
    (n) => n.data.autor.id === slugAutor || n.data.coautores.some((c) => c.id === slugAutor),
  );
}
