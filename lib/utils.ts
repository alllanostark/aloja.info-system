import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata um valor em euros sem casas decimais: 3000 -> "3.000 €" */
export function formatEuro(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Custo por pessoa = preço total ÷ nº camas (arredondado). */
export function costPerPerson(
  totalPrice: number | null | undefined,
  beds: number | null | undefined
): number | null {
  if (!totalPrice || !beds || beds <= 0) return null;
  return Math.round(totalPrice / beds);
}

/** Formata minutos de condução: 35 -> "35 min" */
export function formatDriveTime(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  return `${minutes} min`;
}
