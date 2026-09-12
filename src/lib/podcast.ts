import datos from '../data/episodios.json';

export interface Episodio {
  id: string;
  ciclo: string;
  titulo: string;
  tituloCompleto: string;
  fecha: string;
  duracion: number | null;
  descripcion: string;
  audio: string | null;
  enlace: string | null;
  temporada: number | null;
  numero: number | null;
}

export interface Ciclo {
  slug: string;
  nombre: string;
  formato: string;
  descripcion: string;
  episodios: number;
}

/* El JSON lo genera scripts/podcast/bajar-feed.mjs desde el feed real.
   El sitio se compila contra el archivo, no contra internet. */
export const CICLOS: Ciclo[] = datos.ciclos;
export const EPISODIOS: Episodio[] = datos.episodios as Episodio[];
export const ACTUALIZADO: string = datos.actualizado;
export const PORTADA: string | null = datos.portada;

export function cicloPorSlug(slug: string): Ciclo | undefined {
  return CICLOS.find((c) => c.slug === slug);
}

export function episodiosDe(slug: string): Episodio[] {
  return EPISODIOS.filter((e) => e.ciclo === slug);
}

/** "302" -> "5 min". Para los episodios largos, "1 h 12 min". */
export function duracionLegible(segundos: number | null): string {
  if (!segundos || segundos < 1) return '';
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);
  if (horas > 0) return minutos > 0 ? `${horas} h ${minutos} min` : `${horas} h`;
  return `${Math.max(minutos, 1)} min`;
}

/** Minutos totales de un ciclo, para mostrar el tamaño del archivo */
export function minutosDe(slug: string): number {
  return Math.round(episodiosDe(slug).reduce((s, e) => s + (e.duracion ?? 0), 0) / 60);
}

/** Agrupa por año y mes, para poder recorrer un diario de 194 episodios */
export interface Tramo {
  clave: string;
  etiqueta: string;
  episodios: Episodio[];
}

const MES = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function porMes(episodios: Episodio[]): Tramo[] {
  const mapa = new Map<string, Episodio[]>();

  for (const ep of episodios) {
    const d = new Date(ep.fecha);
    const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const lista = mapa.get(clave);
    if (lista) lista.push(ep);
    else mapa.set(clave, [ep]);
  }

  return [...mapa.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([clave, eps]) => {
      const etiqueta = MES.format(new Date(eps[0].fecha));
      return {
        clave,
        /* "septiembre de 2022" -> "Septiembre de 2022" */
        etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1),
        episodios: eps,
      };
    });
}
