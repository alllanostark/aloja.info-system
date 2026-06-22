import type { SearchResult } from "@/types";
import { formatEuro } from "@/lib/utils";

export interface ProposalOptions {
  obraName?: string | null;
  numWorkers?: number | null;
}

export function buildProposalText(
  items: SearchResult[],
  opts: ProposalOptions = {}
): string {
  const lines: string[] = [];

  // Cabecalho
  const titulo = opts.obraName ? `Proposta de Alojamento - ${opts.obraName}` : "Proposta de Alojamento";
  lines.push(titulo);
  if (opts.numWorkers) {
    lines.push(`Trabalhadores: ${opts.numWorkers}`);
  }
  lines.push(`Imóveis: ${items.length}`);
  lines.push("");

  // Um bloco por imóvel
  items.forEach((item, i) => {
    lines.push(`--- Imóvel ${i + 1} ---`);

    const nome = item.title ?? item.address ?? "Sem título";
    lines.push(nome);

    if (item.address && item.title) {
      lines.push(item.address);
    }

    const custo =
      item.cost_per_person != null
        ? formatEuro(item.cost_per_person)
        : item.total_price != null && item.num_beds
          ? formatEuro(Math.round(item.total_price / item.num_beds))
          : null;

    if (custo) lines.push(`Custo por pessoa: ${custo}/mês`);
    if (item.num_beds) lines.push(`Camas: ${item.num_beds}`);
    if (item.drive_minutes != null) lines.push(`Distância: ${item.drive_minutes} min`);
    if (item.external_url) lines.push(`Anúncio: ${item.external_url}`);

    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function whatsappUrl(text: string): string {
  return "https://wa.me/?text=" + encodeURIComponent(text);
}
