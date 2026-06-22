import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";
import { SearchForm } from "@/components/search/SearchForm";
import { Lock } from "lucide-react";

// A busca (scraping de 8 plataformas + geocoding + drive-time) pode demorar
// dezenas de segundos com Apify real — evita o timeout padrão.
export const maxDuration = 300;

export default async function SearchPage() {
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile);

  return (
    <>
      <TopBar title="Nova Busca" />
      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-display text-ink">
            Nova Busca de Alojamento
          </h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Define a obra e os trabalhadores. Procuramos em 8 plataformas e
            calculamos as melhores combinações.
          </p>
        </div>

        {admin ? (
          <SearchForm />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-16 text-center">
            <Lock size={28} strokeWidth={1.5} className="text-ink-subtle" />
            <p className="mt-3 text-sm font-medium text-ink-muted">
              Apenas a Ingrid (administrador) pode iniciar buscas
            </p>
            <p className="mt-1 text-sm text-ink-subtle">
              Tens acesso de visualização. Consulta os resultados no Histórico.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
