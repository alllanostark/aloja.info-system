// ════════════════════════════════════════════════════════════
// Algoritmo de combinação de imóveis — o diferenciador da Sparks Aloja
//
// Quando não há um imóvel único que cubra todos os trabalhadores,
// sugere combinações de 2-3 imóveis cujas camas somem o necessário.
// Regras (de _pipeline/sparks-aloja.md secção 5.4):
//   - quartos vagos sobrando são aceitáveis
//   - custo/pessoa = preço total ÷ nº camas
//   - ordenação final: sempre por menor custo/pessoa
//   - imóveis sem mobília são válidos (sinalizados)
// ════════════════════════════════════════════════════════════

import type { SearchResult } from "@/types";

export interface Combination {
  type: "single" | "double" | "triple";
  label: string;
  propertyIds: string[];
  properties: SearchResult[];
  totalPrice: number;
  totalBeds: number;
  costPerPerson: number; // total ÷ camas
  spareBeds: number; // camas a mais (vagas)
  withinBudget: boolean;
  hasUnfurnished: boolean;
  maxDriveMinutes: number | null;
  /** true quando pelo menos um imóvel da combinação não tem drive_minutes conhecido */
  driveUnknown: boolean;
}

interface Options {
  workersNeeded: number;
  budgetPerPerson: number;
  maxDriveMinutes?: number;
  /** Nº máximo de combinações devolvidas por categoria. */
  limitPerType?: number;
}

/**
 * Resultado elegível: tem camas e preço, e NÃO viola o limite de condução.
 *
 * Semântica conservadora para drive_minutes null:
 *   - null significa "distância desconhecida" (coords não resolvidas).
 *   - Não excluímos o imóvel (pode ser válido), mas também não o tratamos
 *     como "dentro do raio". A flag driveUnknown na Combination expõe isso
 *     à UI para que o utilizador saiba que o tempo não foi validado.
 *   - Apenas imóveis com drive_minutes confirmadamente acima do limite são
 *     excluídos aqui.
 */
function isEligible(r: SearchResult, maxDrive: number): boolean {
  if (!r.num_beds || r.num_beds <= 0) return false;
  if (r.total_price == null || r.total_price <= 0) return false;
  // Exclui apenas quando o tempo é CONHECIDO e excede o limite.
  // drive_minutes null → distância desconhecida → mantém elegível (não confirma violação).
  if (r.drive_minutes != null && r.drive_minutes > maxDrive) return false;
  return true;
}

function buildCombination(
  type: Combination["type"],
  label: string,
  props: SearchResult[],
  workersNeeded: number,
  budgetPerPerson: number
): Combination {
  const totalPrice = props.reduce((s, p) => s + (p.total_price ?? 0), 0);
  const totalBeds = props.reduce((s, p) => s + (p.num_beds ?? 0), 0);
  const costPerPerson = totalBeds > 0 ? Math.round(totalPrice / totalBeds) : 0;
  const driveTimes = props
    .map((p) => p.drive_minutes)
    .filter((d): d is number => d != null);
  // driveUnknown: verdadeiro se pelo menos um imóvel não tem tempo de condução
  // confirmado. Expõe à UI que esta combinação inclui distâncias não validadas.
  const driveUnknown = props.some((p) => p.drive_minutes == null);

  return {
    type,
    label,
    propertyIds: props.map((p) => p.id),
    properties: props,
    totalPrice,
    totalBeds,
    costPerPerson,
    spareBeds: totalBeds - workersNeeded,
    withinBudget: costPerPerson <= budgetPerPerson,
    hasUnfurnished: props.some((p) => p.furnished === false),
    maxDriveMinutes: driveTimes.length ? Math.max(...driveTimes) : null,
    driveUnknown,
  };
}

/**
 * Gera soluções para cobrir `workersNeeded` trabalhadores.
 * Devolve { singles, doubles, triples } já ordenadas por custo/pessoa.
 */
export function generateCombinations(
  results: SearchResult[],
  {
    workersNeeded,
    budgetPerPerson,
    maxDriveMinutes = 45,
    limitPerType = 6,
  }: Options
): {
  singles: Combination[];
  doubles: Combination[];
  triples: Combination[];
} {
  // Elegíveis, ordenados por custo/pessoa (camas mais baratas primeiro).
  // Limita a 30 candidatos para conter a explosão combinatória dos triplos.
  const eligible = results
    .filter((r) => isEligible(r, maxDriveMinutes))
    .sort((a, b) => (a.cost_per_person ?? 1e9) - (b.cost_per_person ?? 1e9))
    .slice(0, 30);

  // ─── Soluções únicas ───
  const singles = eligible
    .filter((r) => (r.num_beds ?? 0) >= workersNeeded)
    .map((r, i) =>
      buildCombination("single", `Opção ${i + 1}`, [r], workersNeeded, budgetPerPerson)
    )
    .sort(byCost)
    .slice(0, limitPerType);

  // Para combinações, exclui os que já cobrem sozinhos (são "singles").
  const partial = eligible.filter((r) => (r.num_beds ?? 0) < workersNeeded);

  // ─── Combinações de 2 ───
  const doubles: Combination[] = [];
  for (let i = 0; i < partial.length; i++) {
    for (let j = i + 1; j < partial.length; j++) {
      const beds = (partial[i].num_beds ?? 0) + (partial[j].num_beds ?? 0);
      if (beds >= workersNeeded) {
        doubles.push(
          buildCombination(
            "double",
            "",
            [partial[i], partial[j]],
            workersNeeded,
            budgetPerPerson
          )
        );
      }
    }
  }
  doubles.sort(byCost);
  const topDoubles = doubles.slice(0, limitPerType).map(relabel);

  // ─── Combinações de 3 ───
  // Só formamos triplos quando NEM um par cobre (evita redundância): cada par
  // dos três deve ficar abaixo do necessário, senão seria um "double".
  const triples: Combination[] = [];
  for (let i = 0; i < partial.length; i++) {
    for (let j = i + 1; j < partial.length; j++) {
      const bedsIJ = (partial[i].num_beds ?? 0) + (partial[j].num_beds ?? 0);
      if (bedsIJ >= workersNeeded) continue; // já é um double
      for (let k = j + 1; k < partial.length; k++) {
        const beds = bedsIJ + (partial[k].num_beds ?? 0);
        if (beds >= workersNeeded) {
          triples.push(
            buildCombination(
              "triple",
              "",
              [partial[i], partial[j], partial[k]],
              workersNeeded,
              budgetPerPerson
            )
          );
        }
      }
    }
  }
  triples.sort(byCost);
  const topTriples = triples.slice(0, limitPerType).map(relabel);

  return { singles, doubles: topDoubles, triples: topTriples };
}

function byCost(a: Combination, b: Combination): number {
  // 1. Dentro do orçamento primeiro.
  if (a.withinBudget !== b.withinBudget) return a.withinBudget ? -1 : 1;
  // 2. Combinações com drive_minutes confirmados sobem face às de distância
  //    desconhecida — não punimos o utilizador por dados incompletos, mas
  //    informações certas têm prioridade.
  if (a.driveUnknown !== b.driveUnknown) return a.driveUnknown ? 1 : -1;
  // 3. Menor custo/pessoa.
  if (a.costPerPerson !== b.costPerPerson) return a.costPerPerson - b.costPerPerson;
  // 4. Menos vagas sobrando.
  return a.spareBeds - b.spareBeds;
}

function relabel(c: Combination, i: number): Combination {
  const prefix = c.type === "double" ? "Combinação" : "Combinação";
  return { ...c, label: `${prefix} ${String.fromCharCode(65 + i)}` };
}
