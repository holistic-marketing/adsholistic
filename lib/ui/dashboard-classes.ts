/** Clases compartidas del panel (sistema visual v3: tarjetas de 14 px, borde fino). */
export const dashboardClasses = {
  canvas: "dashboard-canvas min-h-screen",
  page: "min-w-0 space-y-4 lg:space-y-5",
  statCard: "dashboard-kpi min-w-0 rounded-card px-5 py-5 sm:px-6",
  sectionCard: "dashboard-surface-card overflow-hidden rounded-card",
  tabPanel:
    "dashboard-surface-card rounded-b-card rounded-tr-card border border-t-0 border-line shadow-card",
} as const;
