import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";

/* Encabezado de las colas de revisión de gerencia (pagos manuales, Profit y
   cobros faltantes): título, bajada, accesos a las otras colas y el filtro
   por cliente. Solo lo ve el equipo, por eso va en español. */

const SEGMENT = "inline-flex h-[26px] items-center rounded-ctl px-3 text-xs font-medium whitespace-nowrap";

export function ReviewQueueHeader({
  area,
  title,
  lede,
  links,
  baseHref,
  filteredId,
  filteredName,
  selected,
}: {
  /** Parte del rótulo: «Finanzas», «Profit COD», «Lo pagado». */
  area: string;
  title: string;
  lede: ReactNode;
  links: Array<{ label: string; href: string }>;
  /** Ruta de esta cola sin filtro. */
  baseHref: string;
  /** Cliente filtrado por `?cliente=`, si lo hay. */
  filteredId: string | null;
  filteredName?: string;
  /** Cliente elegido en el panel (para ofrecer filtrar por él). */
  selected?: { id: string; name: string } | null;
}) {
  const clienteOption = filteredId
    ? { id: filteredId, label: `Filtrado${filteredName ? `: ${filteredName}` : ""}` }
    : selected?.id
      ? { id: selected.id, label: `Solo ${selected.name}` }
      : null;

  return (
    <>
      <PageHeader
        eyebrow={`Gerente · ${area}${filteredId ? " · Filtro cliente" : " · Todos los clientes"}`}
        title={title}
        lede={lede}
        actions={links.map((link) => (
          <Link key={link.href} href={link.href} className={buttonClass("outline", "sm")}>
            {link.label}
            <PanelIcon name="arrow-right" />
          </Link>
        ))}
      />

      {clienteOption ? (
        <FilterBar>
          <nav aria-label="Filtrar por cliente" className="inline-flex max-w-full overflow-x-auto rounded-box bg-subtle p-[3px]">
            <Link
              href={baseHref}
              aria-current={filteredId ? undefined : "page"}
              className={cn(
                SEGMENT,
                filteredId ? "text-ink-2 hover:text-ink" : "bg-surface text-ink shadow-card",
              )}
            >
              Todos los clientes
            </Link>
            <Link
              href={`${baseHref}?cliente=${encodeURIComponent(clienteOption.id)}`}
              aria-current={filteredId ? "page" : undefined}
              className={cn(
                SEGMENT,
                filteredId ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
              )}
            >
              {clienteOption.label}
            </Link>
          </nav>
        </FilterBar>
      ) : null}
    </>
  );
}
