/* Fechas en castellano: 2023-06-20 -> "20 de junio de 2023" */
const FORMATO = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function fechaLarga(fecha: Date): string {
  return FORMATO.format(fecha);
}

/* Para el atributo datetime de <time>: "2023-06-20" */
export function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
