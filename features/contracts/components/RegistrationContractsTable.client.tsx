"use client";

import { useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PanelMenu, PanelPopover, usePopover } from "@/components/ui/PanelPopover.client";
import { Avatar, EmptyState, FilterBar, FilterButton, FilterChip, SearchField, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { reviewMembershipCaptureAction } from "@/features/contracts/actions";

/** Fila ya preparada en el servidor (enlaces firmados y fecha en hora de Lima). */
export interface RegistrationContractView {
  id: string;
  legalName: string;
  email: string;
  company: boolean;
  document: string;
  createdLabel: string;
  sent: boolean;
  status: string;
  signedPdfUrl: string | null;
  proofStatus: string | null;
  proofReason: string | null;
  proofUrl: string | null;
  returnedFromCheckout: boolean;
}

type SignatureKey = "signed" | "pending_signature" | "rejected" | "draft";
type ProofKey = "approved" | "pending_review" | "rejected" | "none";

const SIGNATURE: Record<SignatureKey, { label: string; tone: Tone }> = {
  signed: { label: "Firmado", tone: "ok" },
  pending_signature: { label: "Pendiente", tone: "warn" },
  rejected: { label: "Rechazado", tone: "danger" },
  draft: { label: "Borrador", tone: "neutral" },
};

const PROOF: Record<ProofKey, { label: string; tone: Tone }> = {
  approved: { label: "Aceptada", tone: "ok" },
  pending_review: { label: "En revisión", tone: "info" },
  rejected: { label: "Rechazada", tone: "danger" },
  none: { label: "Sin captura", tone: "neutral" },
};

function signatureKey(status: string): SignatureKey {
  return status === "signed" || status === "rejected" || status === "pending_signature" ? status : "draft";
}

function proofKey(status: string | null): ProofKey {
  return status === "approved" || status === "pending_review" || status === "rejected" ? status : "none";
}

/** Filtro de una sola opción: botón v3 con su menú. */
function FilterMenu<K extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: K | null;
  options: Record<K, { label: string }>;
  onChange: (value: K | null) => void;
}) {
  const { anchorRef, open, toggle, close } = usePopover();
  const keys = Object.keys(options) as K[];
  return (
    <>
      {/* El kit no reenvía `ref`: el ancla es el botón que queda dentro. */}
      <span
        className="contents"
        ref={(node) => {
          anchorRef.current = node?.querySelector("button") ?? null;
        }}
      >
        <FilterButton
          label={label}
          count={value ? 1 : 0}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
        />
      </span>
      <PanelPopover anchorRef={anchorRef} open={open} onClose={close} label={`Filtrar por ${label.toLowerCase()}`}>
        <PanelMenu
          label={label}
          items={[
            { label: "Todos", checked: value === null, inset: true, onSelect: () => { onChange(null); close(); } },
            ...keys.map((key) => ({
              label: options[key].label,
              checked: value === key,
              inset: true,
              onSelect: () => { onChange(key); close(); },
            })),
          ]}
        />
      </PanelPopover>
    </>
  );
}

export function RegistrationContractsTable({ rows }: { rows: RegistrationContractView[] }) {
  const [query, setQuery] = useState("");
  const [signature, setSignature] = useState<SignatureKey | null>(null);
  const [proof, setProof] = useState<ProofKey | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (signature && signatureKey(row.status) !== signature) return false;
      if (proof && proofKey(row.proofStatus) !== proof) return false;
      if (!needle) return true;
      return [row.legalName, row.email, row.document].some((value) => value.toLowerCase().includes(needle));
    });
  }, [rows, query, signature, proof]);

  const chips =
    signature || proof ? (
      <>
        {signature ? <FilterChip name="Firma" value={SIGNATURE[signature].label} removeLabel="Quitar filtro" onRemove={() => setSignature(null)} /> : null}
        {proof ? <FilterChip name="Captura" value={PROOF[proof].label} removeLabel="Quitar filtro" onRemove={() => setProof(null)} /> : null}
      </>
    ) : null;

  return (
    <>
      <FilterBar
        chips={chips}
        tools={
          <span className="text-[13px] text-ink-2">
            <span className="num">{visible.length}</span> de <span className="num">{rows.length}</span> contratos
          </span>
        }
      >
        <SearchField label="Buscar cliente o documento" value={query} onChange={(event) => setQuery(event.target.value)} />
        <FilterMenu label="Firma" value={signature} options={SIGNATURE} onChange={setSignature} />
        <FilterMenu label="Captura del pago" value={proof} options={PROOF} onChange={setProof} />
      </FilterBar>

      <section className="mt-4 min-w-0 rounded-card border border-line bg-surface shadow-card">
        {visible.length === 0 ? (
          <EmptyState icon="contract" title="Ningún contrato coincide" description="Prueba con otro nombre o quita los filtros." />
        ) : (
          <div className="ui-scroll overflow-x-auto px-2 py-2 sm:px-4">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <caption className="sr-only">Contratos de registro</caption>
              <thead>
                <tr className="text-left">
                  {["Cliente", "Documento", "Creado", "FirmEasy", "Firma", "Captura del pago"].map((heading) => (
                    <th key={heading} scope="col" className="h-10 whitespace-nowrap border-b border-line px-2 font-medium text-ink">
                      {heading}
                    </th>
                  ))}
                  <th scope="col" className="h-10 border-b border-line px-2">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const sign = SIGNATURE[signatureKey(row.status)];
                  const capture = PROOF[proofKey(row.proofStatus)];
                  return (
                    <tr key={row.id} className="border-b border-line align-middle last:border-b-0 hover:bg-field">
                      <td className="px-2 py-2.5">
                        <div className="flex min-w-[190px] items-center gap-2.5">
                          <Avatar name={row.legalName} />
                          <div className="grid min-w-0 leading-snug">
                            <b className="max-w-[34ch] truncate font-semibold text-ink">{row.legalName}</b>
                            <small className="max-w-[38ch] truncate text-[11px] text-ink-3">{row.email}</small>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="grid leading-snug">
                          <span>{row.company ? "Empresa" : "Persona natural"}</span>
                          <small className="num text-xs text-ink-3">{row.document}</small>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-ink-2">{row.createdLabel}</td>
                      <td className="px-2 py-2.5">
                        <ToneBadge tone={row.sent ? "ok" : "warn"} dot>
                          {row.sent ? "Enviado" : "Sin envío"}
                        </ToneBadge>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="grid justify-items-start gap-1">
                          <ToneBadge tone={sign.tone} dot>{sign.label}</ToneBadge>
                          {row.signedPdfUrl ? (
                            <a className="inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline" href={row.signedPdfUrl}>
                              <PanelIcon name="file" className="size-3.5" />
                              PDF firmado
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="grid justify-items-start gap-1">
                          <ToneBadge tone={capture.tone} dot>{capture.label}</ToneBadge>
                          {row.returnedFromCheckout ? <small className="text-xs text-ink-3">Volvió de NAS</small> : null}
                          {row.proofReason ? <small className="max-w-[32ch] text-xs text-ink-2">{row.proofReason}</small> : null}
                          {row.proofUrl ? (
                            <a className="inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline" href={row.proofUrl}>
                              <PanelIcon name="eye" className="size-3.5" />
                              Ver captura
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="w-px whitespace-nowrap px-2 py-2.5 text-right">
                        {row.proofStatus === "pending_review" ? (
                          <form action={reviewMembershipCaptureAction} className="inline-flex gap-1.5">
                            <input type="hidden" name="id" value={row.id} />
                            <button name="decision" value="approved" type="submit" className={buttonClass("primary", "sm")}>
                              Aceptar<span className="sr-only"> la captura de {row.legalName}</span>
                            </button>
                            <button name="decision" value="rejected" type="submit" className={buttonClass("outline", "sm")}>
                              Rechazar<span className="sr-only"> la captura de {row.legalName}</span>
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
