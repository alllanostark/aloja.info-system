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
  | "nav.contacts"
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
  | "lang.label"
  // Accommodations — tabs
  | "accommodations.tabs.active"
  | "accommodations.tabs.inactive"
  | "accommodations.tabs.external"
  // Accommodations — external
  | "accommodations.external.badge"
  | "accommodations.external.empty"
  | "accommodations.external.emptyCta"
  // Accommodations — form
  | "accommodations.form.mode.searched"
  | "accommodations.form.mode.external"
  | "accommodations.form.contact"
  | "accommodations.form.contactNone"
  | "accommodations.form.createContact"
  // Accommodations — fields
  | "accommodations.field.honorarium"
  | "accommodations.field.deposit"
  // Contacts
  | "contacts.search.placeholder"
  | "contacts.linkedAccommodations"
  // Combination — financial
  | "combination.financial.title"
  | "combination.financial.expenses"
  | "combination.financial.expensesSub"
  | "combination.financial.credits"
  | "combination.financial.creditsSub"
  | "combination.financial.initial"
  | "combination.financial.initialSub"
  | "combination.financial.rent"
  | "combination.financial.honorarium"
  | "combination.financial.deposit"
  | "combination.financial.total"
  | "combination.financial.net"
  | "combination.financial.netSub"
  | "combination.financial.perPerson"
  | "combination.financial.perProperty"
  | "combination.financial.afterDeposit"
  | "combination.financial.netLabel"
  // Combination — edit
  | "combination.edit.edit"
  | "combination.edit.swap"
  | "combination.edit.add"
  | "combination.edit.remove"
  | "combination.edit.removeConfirm"
  | "combination.edit.save"
  | "combination.edit.cancel"
  // Combination — fields
  | "combination.field.beds"
  | "combination.field.drive"
  | "combination.field.rent"
  | "combination.field.honorarium"
  | "combination.field.deposit"
  | "combination.field.finalPrice"
  // Combination — picker
  | "combination.picker.title"
  | "combination.picker.sources.search"
  | "combination.picker.sources.active"
  | "combination.picker.sources.external"
  | "combination.picker.sources.discarded"
  | "combination.picker.search"
  | "combination.picker.confirm"
  | "combination.picker.empty"
  // Combination — actions
  | "combination.saveAs"
  | "combination.update"
  | "combination.rename"
  | "combination.saved"
  // History — tabs
  | "history.tabs.searches"
  | "history.tabs.combinations"
  | "history.tabs.combinationsEmpty"
  // Tooltips
  | "tooltip.honorarium"
  | "tooltip.deposit"
  | "tooltip.finalPrice";

type Dictionary = Record<TranslationKey, string>;

// ── Traduções ───────────────────────────────────────────────────────────────

const dictionaries: Record<Locale, Dictionary> = {
  pt: {
    "nav.section": "Operação",
    "nav.dashboard": "Dashboard",
    "nav.search": "Nova Busca",
    "nav.accommodations": "Alojamentos Ativos",
    "nav.history": "Histórico",
    "nav.contacts": "Contactos",
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
    "accommodations.tabs.active": "Ativos",
    "accommodations.tabs.inactive": "Inativos",
    "accommodations.tabs.external": "Externos",
    "accommodations.external.badge": "Externo",
    "accommodations.external.empty": "Cadastre alojamentos externos (proprietários, imobiliárias) para usá-los nas combinações.",
    "accommodations.external.emptyCta": "Adicionar alojamento externo",
    "accommodations.form.mode.searched": "Pesquisado (ativo)",
    "accommodations.form.mode.external": "Externo (manual)",
    "accommodations.form.contact": "Contacto vinculado",
    "accommodations.form.contactNone": "Sem contacto",
    "accommodations.form.createContact": "Criar novo contacto",
    "accommodations.field.honorarium": "Honorário (€)",
    "accommodations.field.deposit": "Calção (€)",
    "contacts.search.placeholder": "Buscar por nome, telefone, empresa, email…",
    "contacts.linkedAccommodations": "alojamentos externos",
    "combination.financial.title": "Visão financeira",
    "combination.financial.expenses": "Gastos",
    "combination.financial.expensesSub": "durante o contrato",
    "combination.financial.credits": "Créditos",
    "combination.financial.creditsSub": "a recuperar",
    "combination.financial.initial": "Ingresso inicial",
    "combination.financial.initialSub": "saída de caixa no 1º mês",
    "combination.financial.rent": "Aluguel × meses",
    "combination.financial.honorarium": "Honorários",
    "combination.financial.deposit": "Calções",
    "combination.financial.total": "Total",
    "combination.financial.net": "Custo real líquido",
    "combination.financial.netSub": "gastos − créditos",
    "combination.financial.perPerson": "por pessoa",
    "combination.financial.perProperty": "por imóvel",
    "combination.financial.afterDeposit": "após devolução da calção",
    "combination.financial.netLabel": "líquido",
    "combination.edit.edit": "Editar",
    "combination.edit.swap": "Trocar",
    "combination.edit.add": "Adicionar imóvel",
    "combination.edit.remove": "Remover",
    "combination.edit.removeConfirm": "Remover este imóvel da combinação?",
    "combination.edit.save": "Guardar edição",
    "combination.edit.cancel": "Cancelar",
    "combination.field.beds": "Camas",
    "combination.field.drive": "Drive (min)",
    "combination.field.rent": "Mensalidade (€)",
    "combination.field.honorarium": "Honorário (€)",
    "combination.field.deposit": "Calção (€)",
    "combination.field.finalPrice": "Preço final negociado (€)",
    "combination.picker.title": "Escolher imóvel",
    "combination.picker.sources.search": "Pesquisa atual",
    "combination.picker.sources.active": "Alojamentos ativos",
    "combination.picker.sources.external": "Alojamentos externos",
    "combination.picker.sources.discarded": "Excluídos",
    "combination.picker.search": "Filtrar por nome, endereço, cidade…",
    "combination.picker.confirm": "Confirmar",
    "combination.picker.empty": "Nenhum imóvel disponível nesta fonte para esta busca.",
    "combination.saveAs": "Salvar composição",
    "combination.update": "Atualizar composição",
    "combination.rename": "Renomear",
    "combination.saved": "Composição salva",
    "history.tabs.searches": "Buscas",
    "history.tabs.combinations": "Composições",
    "history.tabs.combinationsEmpty": "Você ainda não salvou nenhuma composição.",
    "tooltip.honorarium": "Pago uma vez. Não volta.",
    "tooltip.deposit": "Pago no início. Volta no fim do contrato.",
    "tooltip.finalPrice": "Sobrescreve a mensalidade. Para casos de barganha.",
  },
  es: {
    "nav.section": "Operación",
    "nav.dashboard": "Panel",
    "nav.search": "Nueva Búsqueda",
    "nav.accommodations": "Alojamientos Activos",
    "nav.history": "Historial",
    "nav.contacts": "Contactos",
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
    "accommodations.tabs.active": "Activos",
    "accommodations.tabs.inactive": "Inactivos",
    "accommodations.tabs.external": "Externos",
    "accommodations.external.badge": "Externo",
    "accommodations.external.empty": "Registra alojamientos externos (propietarios, inmobiliarias) para usarlos en las combinaciones.",
    "accommodations.external.emptyCta": "Añadir alojamiento externo",
    "accommodations.form.mode.searched": "Buscado (activo)",
    "accommodations.form.mode.external": "Externo (manual)",
    "accommodations.form.contact": "Contacto vinculado",
    "accommodations.form.contactNone": "Sin contacto",
    "accommodations.form.createContact": "Crear nuevo contacto",
    "accommodations.field.honorarium": "Honorario (€)",
    "accommodations.field.deposit": "Fianza (€)",
    "contacts.search.placeholder": "Buscar por nombre, teléfono, empresa, email…",
    "contacts.linkedAccommodations": "alojamientos externos",
    "combination.financial.title": "Visión financiera",
    "combination.financial.expenses": "Gastos",
    "combination.financial.expensesSub": "durante el contrato",
    "combination.financial.credits": "Créditos",
    "combination.financial.creditsSub": "a recuperar",
    "combination.financial.initial": "Entrada inicial",
    "combination.financial.initialSub": "salida de caja el 1er mes",
    "combination.financial.rent": "Alquiler × meses",
    "combination.financial.honorarium": "Honorarios",
    "combination.financial.deposit": "Fianzas",
    "combination.financial.total": "Total",
    "combination.financial.net": "Coste real neto",
    "combination.financial.netSub": "gastos − créditos",
    "combination.financial.perPerson": "por persona",
    "combination.financial.perProperty": "por inmueble",
    "combination.financial.afterDeposit": "tras devolución de la fianza",
    "combination.financial.netLabel": "neto",
    "combination.edit.edit": "Editar",
    "combination.edit.swap": "Cambiar",
    "combination.edit.add": "Añadir inmueble",
    "combination.edit.remove": "Quitar",
    "combination.edit.removeConfirm": "¿Quitar este inmueble de la combinación?",
    "combination.edit.save": "Guardar edición",
    "combination.edit.cancel": "Cancelar",
    "combination.field.beds": "Camas",
    "combination.field.drive": "Trayecto (min)",
    "combination.field.rent": "Mensualidad (€)",
    "combination.field.honorarium": "Honorario (€)",
    "combination.field.deposit": "Fianza (€)",
    "combination.field.finalPrice": "Precio final negociado (€)",
    "combination.picker.title": "Elegir inmueble",
    "combination.picker.sources.search": "Búsqueda actual",
    "combination.picker.sources.active": "Alojamientos activos",
    "combination.picker.sources.external": "Alojamientos externos",
    "combination.picker.sources.discarded": "Excluidos",
    "combination.picker.search": "Filtrar por nombre, dirección, ciudad…",
    "combination.picker.confirm": "Confirmar",
    "combination.picker.empty": "Ningún inmueble disponible en esta fuente para esta búsqueda.",
    "combination.saveAs": "Guardar composición",
    "combination.update": "Actualizar composición",
    "combination.rename": "Renombrar",
    "combination.saved": "Composición guardada",
    "history.tabs.searches": "Búsquedas",
    "history.tabs.combinations": "Composiciones",
    "history.tabs.combinationsEmpty": "Aún no has guardado ninguna composición.",
    "tooltip.honorarium": "Pago una vez. No vuelve.",
    "tooltip.deposit": "Pago al inicio. Vuelve al final del contrato.",
    "tooltip.finalPrice": "Sustituye la mensualidad. Para casos de negociación.",
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
