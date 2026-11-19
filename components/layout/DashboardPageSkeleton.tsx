/** Mientras carga una sección: la misma forma que una página v3 (encabezado, indicadores y tarjeta). */
export function DashboardPageSkeleton() {
  return (
    <div className="min-w-0 animate-pulse" aria-busy="true" data-page-skeleton="">
      <div className="mb-5 space-y-2">
        <div className="h-7 w-48 max-w-full rounded-ctl bg-subtle" />
        <div className="h-4 w-full max-w-md rounded-ctl bg-subtle" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[132px] rounded-card border border-line bg-surface shadow-card" />
        ))}
      </div>

      <div className="mt-4 h-60 rounded-card border border-line bg-surface shadow-card sm:h-80" />
    </div>
  );
}
