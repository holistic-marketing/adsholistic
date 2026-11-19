/* Esqueleto de las secciones de Pagos: tarjetas v3 con líneas de relleno suave. */
export function PaymentsSectionSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div aria-hidden className="animate-pulse space-y-4 motion-reduce:animate-none">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-card border border-line bg-surface px-4 py-5 shadow-card sm:px-6"
        >
          <div className="h-4 w-40 rounded-full bg-subtle" />
          <div className="mt-2 h-3 w-64 max-w-full rounded-full bg-subtle" />
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((__, cell) => (
              <div key={cell} className="h-[72px] rounded-box bg-field" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
