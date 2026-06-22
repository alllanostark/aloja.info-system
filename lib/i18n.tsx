"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Locales suportados ──────────────────────────────────────────────────────

export type Locale = "pt" | "es";

// ── Dicionário de chaves tipadas ────────────────────────────────────────────

export type TranslationKey =
  // Sidebar — secção
  | "nav.section"
  // Sidebar — itens de navegação
  | "nav.dashboard"
  | "nav.search"
  | "nav.accommodations"
  | "nav.history"
  // Sidebar — footer
  | "nav.role.admin"
  | "nav.role.viewer"
  | "nav.logout"
  // TopBar — títulos de página
  | "page.dashboard"
  | "page.search"
  | "page.accommodations"
  | "page.history"
  // Rótulos de ação comuns
  | "action.newSearch"
  | "action.save"
  | "action.cancel"
  | "action.confirm"
  | "action.delete"
  | "action.edit"
  | "action.back"
  | "action.close"
  | "action.viewAd"
  | "action.export"
  // Estados genéricos
  | "state.loading"
  | "state.empty"
  | "state.error"
  // Toggle de idioma
  | "lang.label";

type Dictionary = Record<TranslationKey, string>;

// ── Traduções ───────────────────────────────────────────────────────────────

const dictionaries: Record<Locale, Dictionary> = {
  pt: {
    "nav.section": "Operação",
    "nav.dashboard": "Dashboard",
    "nav.search": "Nova Busca",
    "nav.accommodations": "Alojamentos Ativos",
    "nav.history": "Histórico",
    "nav.role.admin": "Administrador",
    "nav.role.viewer": "Visualização",
    "nav.logout": "Terminar sessão",
    "page.dashboard": "Dashboard",
    "page.search": "Nova Busca",
    "page.accommodations": "Alojamentos Ativos",
    "page.history": "Histórico",
    "action.newSearch": "Nova Busca",
    "action.save": "Guardar",
    "action.cancel": "Cancelar",
    "action.confirm": "Confirmar",
    "action.delete": "Eliminar",
    "action.edit": "Editar",
    "action.back": "Voltar",
    "action.close": "Fechar",
    "action.viewAd": "Ver anúncio",
    "action.export": "Exportar",
    "state.loading": "A carregar...",
    "state.empty": "Sem resultados",
    "state.error": "Erro ao carregar",
    "lang.label": "Idioma",
  },
  es: {
    "nav.section": "Operación",
    "nav.dashboard": "Panel",
    "nav.search": "Nueva Búsqueda",
    "nav.accommodations": "Alojamientos Activos",
    "nav.history": "Historial",
    "nav.role.admin": "Administrador",
    "nav.role.viewer": "Solo lectura",
    "nav.logout": "Cerrar sesión",
    "page.dashboard": "Panel",
    "page.search": "Nueva Búsqueda",
    "page.accommodations": "Alojamientos Activos",
    "page.history": "Historial",
    "action.newSearch": "Nueva Búsqueda",
    "action.save": "Guardar",
    "action.cancel": "Cancelar",
    "action.confirm": "Confirmar",
    "action.delete": "Eliminar",
    "action.edit": "Editar",
    "action.back": "Volver",
    "action.close": "Cerrar",
    "action.viewAd": "Ver anuncio",
    "action.export": "Exportar",
    "state.loading": "Cargando...",
    "state.empty": "Sin resultados",
    "state.error": "Error al cargar",
    "lang.label": "Idioma",
  },
};

// ── Context ─────────────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "sparks-locale";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "pt";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "pt" || stored === "es") return stored;
    // Fallback: detectar via navigator.language
    const lang = navigator.language?.slice(0, 2).toLowerCase();
    if (lang === "es") return "es";
  } catch {
    // localStorage pode estar bloqueado em alguns contextos
  }
  return "pt";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt");

  // Hidratação após mount para evitar mismatch SSR
  useEffect(() => {
    setLocaleState(detectInitialLocale());
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignorar se bloqueado
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return dictionaries[locale][key] ?? key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook público ─────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n deve ser usado dentro de <I18nProvider>");
  }
  return ctx;
}
