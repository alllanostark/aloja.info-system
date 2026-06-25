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
  // Dock — quick actions
  | "dock.new_search"
  | "dock.add_contact"
  | "dock.add_external"
  | "dock.compositions"
  | "dock.recent_history"
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
  | "state.saveFailed"
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
  | "tooltip.finalPrice"
  // Accommodations — form fields
  | "accommodations.form.title"
  | "accommodations.form.newContactName"
  | "accommodations.form.newContactPhone"
  | "accommodations.field.address"
  | "accommodations.field.city"
  | "accommodations.field.beds"
  | "accommodations.field.rent"
  | "accommodations.field.obra"
  | "accommodations.field.contractStart"
  | "accommodations.field.contractEnd"
  | "accommodations.field.owner"
  | "accommodations.field.phone"
  | "accommodations.field.furnished"
  | "accommodations.field.furnished.yes"
  | "accommodations.field.furnished.no"
  | "accommodations.field.notes"
  // Accommodations — card labels
  | "accommodations.card.rent"
  | "accommodations.card.costPP"
  | "accommodations.card.owner"
  | "accommodations.card.contract"
  | "accommodations.card.bedGrid"
  | "accommodations.card.notes"
  | "accommodations.card.full"
  | "accommodations.card.deactivate"
  | "accommodations.card.reactivate"
  | "accommodations.card.remove"
  | "accommodations.card.confirmDelete"
  | "accommodations.card.beds.total"
  | "accommodations.card.beds.occupied"
  | "accommodations.card.beds.vacant"
  // Accommodations — empty states
  | "accommodations.empty.active"
  | "accommodations.empty.activeSub"
  | "accommodations.empty.inactive"
  | "accommodations.empty.inactiveSub"
  | "accommodations.empty.add"
  // Contacts — toolbar
  | "contacts.city.placeholder"
  | "contacts.city.all"
  | "contacts.add"
  | "contacts.cancel"
  // Contacts — rating labels
  | "contacts.rating.all"
  | "contacts.rating.good"
  | "contacts.rating.neutral"
  | "contacts.rating.bad"
  // Contacts — card
  | "contacts.lastUsed"
  | "contacts.neverUsed"
  | "contacts.deleteConfirm"
  | "contacts.cancelDelete"
  // Contacts — empty states
  | "contacts.empty.title"
  | "contacts.empty.sub"
  | "contacts.filtered.empty"
  // Combination — card summary
  | "combination.card.properties"
  | "combination.card.withinBudget"
  | "combination.card.above"
  | "combination.card.furnish"
  | "combination.card.hint"
  | "combination.card.costPerMonth"
  | "combination.card.negotiated"
  | "combination.card.costDistribution"
  | "combination.card.perMonth"
  // Combination — duration selector
  | "combination.duration.label"
  | "combination.duration.months"
  | "combination.duration.weeks"
  | "combination.duration.days"
  // Combination — note
  | "combination.note.label"
  | "combination.note.placeholder"
  // Combination — footer actions
  | "combination.action.share"
  | "combination.action.copied"
  | "combination.action.saving"
  | "combination.action.saved"
  | "combination.action.saveResult"
  | "combination.action.partialSave"
  // Combination — furnish badge
  | "combination.furnish"
  // History — combination card
  | "history.combination.netCost"
  | "history.combination.property"
  | "history.combination.properties"
  | "history.combination.deleteConfirm";

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
    "dock.new_search": "Nova busca",
    "dock.add_contact": "Adicionar contacto",
    "dock.add_external": "Adicionar alojamento externo",
    "dock.compositions": "Composições salvas",
    "dock.recent_history": "Histórico recente",
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
    "state.saveFailed": "Erro ao guardar. Tenta novamente.",
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
    "accommodations.form.title": "Adicionar Alojamento",
    "accommodations.form.newContactName": "Nome",
    "accommodations.form.newContactPhone": "Telefone",
    "accommodations.field.address": "Endereço",
    "accommodations.field.city": "Cidade",
    "accommodations.field.beds": "Nº de camas",
    "accommodations.field.rent": "Renda mensal (€)",
    "accommodations.field.obra": "Obra associada",
    "accommodations.field.contractStart": "Início do contrato",
    "accommodations.field.contractEnd": "Fim do contrato",
    "accommodations.field.owner": "Proprietário",
    "accommodations.field.phone": "Telefone",
    "accommodations.field.furnished": "Mobilado?",
    "accommodations.field.furnished.yes": "Sim",
    "accommodations.field.furnished.no": "Não (precisa mobilar)",
    "accommodations.field.notes": "Notas",
    "accommodations.card.rent": "Renda",
    "accommodations.card.costPP": "Custo/pessoa",
    "accommodations.card.owner": "Proprietário",
    "accommodations.card.contract": "Contrato",
    "accommodations.card.bedGrid": "Grelha de camas",
    "accommodations.card.notes": "Notas",
    "accommodations.card.full": "Cheio",
    "accommodations.card.deactivate": "Inativar",
    "accommodations.card.reactivate": "Reativar",
    "accommodations.card.remove": "Remover alojamento",
    "accommodations.card.confirmDelete": "Tens a certeza?",
    "accommodations.card.beds.total": "total",
    "accommodations.card.beds.occupied": "ocup.",
    "accommodations.card.beds.vacant": "vagas",
    "accommodations.empty.active": "Sem alojamentos ativos",
    "accommodations.empty.activeSub": "Ainda não há nenhum imóvel registado. Adiciona o primeiro alojamento para começar a gerir a ocupação de camas.",
    "accommodations.empty.inactive": "Sem alojamentos inativos",
    "accommodations.empty.inactiveSub": "Alojamentos marcados como inativos aparecerão aqui.",
    "accommodations.empty.add": "Adicionar alojamento",
    "contacts.city.placeholder": "Filtrar por cidade…",
    "contacts.city.all": "Todas as cidades",
    "contacts.add": "Adicionar Contacto",
    "contacts.cancel": "Cancelar",
    "contacts.rating.all": "Todos",
    "contacts.rating.good": "Bons",
    "contacts.rating.neutral": "Neutros",
    "contacts.rating.bad": "Maus",
    "contacts.lastUsed": "Último uso:",
    "contacts.neverUsed": "Nunca utilizado",
    "contacts.deleteConfirm": "Clica novamente para confirmar",
    "contacts.cancelDelete": "Cancelar eliminação",
    "contacts.empty.title": "Sem contactos na base de dados",
    "contacts.empty.sub": "Adiciona proprietários e agências para os encontrares facilmente em buscas futuras.",
    "contacts.filtered.empty": "Nenhum contacto corresponde aos filtros.",
    "combination.card.properties": "imóveis",
    "combination.card.withinBudget": "No orçamento",
    "combination.card.above": "Acima",
    "combination.card.furnish": "mobilar",
    "combination.card.hint": "Clica para detalhes e simulação de estadia",
    "combination.card.costPerMonth": "Custo líquido/mês",
    "combination.card.negotiated": "negociado",
    "combination.card.costDistribution": "Distribuição de custo por imóvel",
    "combination.card.perMonth": "/mês",
    "combination.duration.label": "Duração da estadia",
    "combination.duration.months": "Meses",
    "combination.duration.weeks": "Semanas",
    "combination.duration.days": "Dias",
    "combination.note.label": "Nota",
    "combination.note.placeholder": "Notas sobre esta combinação...",
    "combination.action.share": "Partilhar",
    "combination.action.copied": "Copiado",
    "combination.action.saving": "A guardar...",
    "combination.action.saved": "Guardado",
    "combination.action.saveResult": "Guardar combinação",
    "combination.action.partialSave": "Imóveis ativos/externos não entram aqui — use 'Salvar composição'.",
    "combination.furnish": "Precisa Mobilar",
    "history.combination.netCost": "Custo líquido",
    "history.combination.property": "imóvel",
    "history.combination.properties": "imóveis",
    "history.combination.deleteConfirm": "Confirmar",
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
    "dock.new_search": "Nueva búsqueda",
    "dock.add_contact": "Añadir contacto",
    "dock.add_external": "Añadir alojamiento externo",
    "dock.compositions": "Composiciones guardadas",
    "dock.recent_history": "Historial reciente",
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
    "state.saveFailed": "Error al guardar. Inténtalo de nuevo.",
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
    "accommodations.form.title": "Añadir Alojamiento",
    "accommodations.form.newContactName": "Nombre",
    "accommodations.form.newContactPhone": "Teléfono",
    "accommodations.field.address": "Dirección",
    "accommodations.field.city": "Ciudad",
    "accommodations.field.beds": "Nº de camas",
    "accommodations.field.rent": "Alquiler mensual (€)",
    "accommodations.field.obra": "Obra asociada",
    "accommodations.field.contractStart": "Inicio del contrato",
    "accommodations.field.contractEnd": "Fin del contrato",
    "accommodations.field.owner": "Propietario",
    "accommodations.field.phone": "Teléfono",
    "accommodations.field.furnished": "¿Amueblado?",
    "accommodations.field.furnished.yes": "Sí",
    "accommodations.field.furnished.no": "No (necesita amueblarse)",
    "accommodations.field.notes": "Notas",
    "accommodations.card.rent": "Alquiler",
    "accommodations.card.costPP": "Coste/persona",
    "accommodations.card.owner": "Propietario",
    "accommodations.card.contract": "Contrato",
    "accommodations.card.bedGrid": "Cuadrícula de camas",
    "accommodations.card.notes": "Notas",
    "accommodations.card.full": "Lleno",
    "accommodations.card.deactivate": "Desactivar",
    "accommodations.card.reactivate": "Reactivar",
    "accommodations.card.remove": "Eliminar alojamiento",
    "accommodations.card.confirmDelete": "¿Estás seguro?",
    "accommodations.card.beds.total": "total",
    "accommodations.card.beds.occupied": "ocup.",
    "accommodations.card.beds.vacant": "libres",
    "accommodations.empty.active": "Sin alojamientos activos",
    "accommodations.empty.activeSub": "Aún no hay ningún inmueble registrado. Añade el primer alojamiento para empezar a gestionar la ocupación de camas.",
    "accommodations.empty.inactive": "Sin alojamientos inactivos",
    "accommodations.empty.inactiveSub": "Los alojamientos marcados como inactivos aparecerán aquí.",
    "accommodations.empty.add": "Añadir alojamiento",
    "contacts.city.placeholder": "Filtrar por ciudad…",
    "contacts.city.all": "Todas las ciudades",
    "contacts.add": "Añadir Contacto",
    "contacts.cancel": "Cancelar",
    "contacts.rating.all": "Todos",
    "contacts.rating.good": "Buenos",
    "contacts.rating.neutral": "Neutros",
    "contacts.rating.bad": "Malos",
    "contacts.lastUsed": "Último uso:",
    "contacts.neverUsed": "Nunca utilizado",
    "contacts.deleteConfirm": "Haz clic de nuevo para confirmar",
    "contacts.cancelDelete": "Cancelar eliminación",
    "contacts.empty.title": "Sin contactos en la base de datos",
    "contacts.empty.sub": "Añade propietarios y agencias para encontrarlos fácilmente en búsquedas futuras.",
    "contacts.filtered.empty": "Ningún contacto coincide con los filtros.",
    "combination.card.properties": "inmuebles",
    "combination.card.withinBudget": "Dentro del presupuesto",
    "combination.card.above": "Por encima",
    "combination.card.furnish": "amueblar",
    "combination.card.hint": "Haz clic para detalles y simulación de estancia",
    "combination.card.costPerMonth": "Coste neto/mes",
    "combination.card.negotiated": "negociado",
    "combination.card.costDistribution": "Distribución de coste por inmueble",
    "combination.card.perMonth": "/mes",
    "combination.duration.label": "Duración de la estancia",
    "combination.duration.months": "Meses",
    "combination.duration.weeks": "Semanas",
    "combination.duration.days": "Días",
    "combination.note.label": "Nota",
    "combination.note.placeholder": "Notas sobre esta combinación...",
    "combination.action.share": "Compartir",
    "combination.action.copied": "Copiado",
    "combination.action.saving": "Guardando...",
    "combination.action.saved": "Guardado",
    "combination.action.saveResult": "Guardar combinación",
    "combination.action.partialSave": "Inmuebles activos/externos no se incluyen aquí — usa 'Guardar composición'.",
    "combination.furnish": "Necesita Amueblarse",
    "history.combination.netCost": "Coste neto",
    "history.combination.property": "inmueble",
    "history.combination.properties": "inmuebles",
    "history.combination.deleteConfirm": "Confirmar",
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
