/** Para buscar sin distinguir mayúsculas ni tildes. */
export const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
