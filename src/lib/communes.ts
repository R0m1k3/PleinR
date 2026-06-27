// Communes de la Communauté de communes du Bassin de Pompey.
export const BASSIN_POMPEY_COMMUNES = [
  "Bouxières-aux-Dames",
  "Champigneulles",
  "Custines",
  "Faulx",
  "Frouard",
  "Lay-Saint-Christophe",
  "Liverdun",
  "Malleloy",
  "Marbache",
  "Millery",
  "Montenoy",
  "Pompey",
  "Saizerais",
] as const;

// Liste d'options incluant une valeur courante hors liste (pour ne pas la perdre).
export function communeOptions(current?: string | null): string[] {
  const list = [...BASSIN_POMPEY_COMMUNES] as string[];
  const c = (current ?? "").trim();
  if (c && !list.includes(c)) list.unshift(c);
  return list;
}
