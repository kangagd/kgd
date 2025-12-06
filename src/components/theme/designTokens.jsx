export const colors = {
  bgPage: "bg-slate-50",
  bgCard: "bg-white",
  borderSubtle: "border-slate-200",
  textMain: "text-gray-900",
  textMuted: "text-gray-500",
  accent: "text-yellow-500", // match KangarooGD yellow usage
};

export const typography = {
  pageTitle: "text-lg font-semibold text-gray-900",
  pageSubtitle: "text-xs text-gray-500",
  sectionTitle: "text-sm font-semibold text-gray-900",
  label: "text-[11px] font-medium text-gray-600",
  bodyXs: "text-xs text-gray-700",
  bodyMutedXs: "text-xs text-gray-500",
};

export const layout = {
  pageContainer: "p-4 md:p-6 space-y-4",
  card: "rounded-xl border border-slate-200 bg-white shadow-sm p-4 md:p-5",
  cardTight: "rounded-xl border border-slate-200 bg-white shadow-sm p-3 md:p-4",
};

export const forms = {
  label: "block text-[11px] font-medium text-gray-600 mb-1",
  inputSm: "h-8 text-xs",
  inputXs: "h-7 text-[11px]",
};

export const tables = {
  wrapper: "overflow-x-auto",
  table: "min-w-full text-xs",
  thead: "text-[11px] uppercase text-gray-500 border-b border-slate-200",
  th: "px-2 py-2 text-left",
  tr: "hover:bg-slate-50 transition-colors",
  td: "px-2 py-2 align-top",
};

export const designTokens = {
  colors,
  typography,
  layout,
  forms,
  tables,
};

export default designTokens;