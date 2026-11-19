/** Mientras carga: la forma de «Cuentas publicitarias» v3 (encabezado con saldo, plataforma, perfiles, filtros y tabla). */
export default function AdAccountsLoading() {
  return (
    <div className="min-w-0 animate-pulse motion-reduce:animate-none" aria-busy="true">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-[1_1_320px] space-y-2">
          <div className="h-8 w-64 max-w-full rounded-ctl bg-subtle" />
          <div className="h-4 w-full max-w-md rounded-ctl bg-subtle" />
        </div>
        <div className="h-[72px] w-40 rounded-ctl bg-subtle" />
      </div>

      <div className="h-[38px] w-full rounded-box bg-subtle sm:w-64" />

      <div className="mt-4 h-28 rounded-card border border-line bg-surface shadow-card" />

      <div className="mt-4 h-[62px] rounded-box border border-line bg-surface shadow-card" />

      <div className="mt-4 rounded-card border border-line bg-surface p-2 shadow-card">
        <div className="h-10 border-b border-line" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex h-[59px] items-center gap-3 border-b border-line px-2 last:border-b-0">
            <div className="size-8 shrink-0 rounded-ctl bg-subtle" />
            <div className="h-3.5 w-40 rounded-ctl bg-subtle" />
            <div className="ml-auto h-3.5 w-20 rounded-ctl bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
