"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import type { PartnerWithStats } from "@/lib/partners/partners-admin.server";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { PanelDialog } from "@/components/ui/PanelDialog.client";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState, Note, StatCard, ToneBadge } from "@/components/ui/PanelKit";
import { PanelMenu, PanelPopover, usePopover, type PanelMenuItem } from "@/components/ui/PanelPopover.client";
import {
  assignClientToPartnerAction,
  markPartnerCommissionsPaidAction,
  savePartnerAction,
  setPartnerStatusAction,
  type PartnerInput,
} from "../actions";
import { AlianzasHeader } from "./AlianzasHeader";

const SITE = "https://www.adsholistic.com";
const FORM_ID = "alianza-form";
const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

const EMPTY: PartnerInput = {
  id: null,
  slug: "",
  name: "",
  headline: "",
  subheadline: "",
  logoUrl: "",
  photoUrl: "",
  accentColor: "#ff781f",
  whatsapp: "",
  commissionPercent: 20,
  commissionDays: 50,
  clientFeePercent: null,
  notes: "",
};

function toInput(p: PartnerWithStats): PartnerInput {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    headline: p.headline ?? "",
    subheadline: p.subheadline ?? "",
    logoUrl: p.logoUrl ?? "",
    photoUrl: p.photoUrl ?? "",
    accentColor: p.accentColor,
    whatsapp: p.whatsapp ?? "",
    commissionPercent: Math.round(p.commissionRate * 10000) / 100,
    commissionDays: p.commissionDays,
    clientFeePercent: p.clientFeePercent,
    notes: p.notes ?? "",
  };
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function AlianzasPanel({ partners }: { partners: PartnerWithStats[] }) {
  const [form, setForm] = useState<PartnerInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ranked = useMemo(
    () => [...partners].sort((a, b) => b.stats.payingClients - a.stats.payingClients || b.stats.signups - a.stats.signups || b.stats.visits30d - a.stats.visits30d),
    [partners],
  );
  const totals = useMemo(
    () =>
      partners.reduce(
        (t, p) => ({
          visits: t.visits + p.stats.visits30d,
          signups: t.signups + p.stats.signups,
          paying: t.paying + p.stats.payingClients,
          pendingCents: t.pendingCents + p.stats.commissionPendingCents,
        }),
        { visits: 0, signups: 0, paying: 0, pendingCents: 0 },
      ),
    [partners],
  );

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        setNotice(ok);
        setForm(null);
      } else setError(result.error);
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Link copiado.");
    } catch {
      setError("No se pudo copiar el link.");
    }
  }

  const openForm = (next: PartnerInput) => {
    setError(null);
    setForm(next);
  };

  const update = <K extends keyof PartnerInput>(key: K, value: PartnerInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <div>
      <AlianzasHeader
        actions={
          <Button onClick={() => openForm({ ...EMPTY })}>
            <PanelIcon name="plus" />
            Nuevo aliado
          </Button>
        }
      />

      <div className="grid gap-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          <StatCard label="Visitas, últimos 30 días" value={totals.visits.toLocaleString("es-PE")} />
          <StatCard label="Registros" value={totals.signups.toLocaleString("es-PE")} />
          <StatCard label="Clientes que pagan" value={totals.paying.toLocaleString("es-PE")} />
          <StatCard label="Comisión por pagar" value={usd(totals.pendingCents)} />
        </div>

        {error && !form ? <Note tone="danger">{error}</Note> : null}
        {notice ? (
          <Note tone="ok" icon="check-circle">
            {notice}
          </Note>
        ) : null}

        {ranked.length === 0 ? (
          <section className="rounded-card border border-line bg-surface shadow-card">
            <EmptyState
              icon="users"
              title="Aún no hay aliados"
              description="Crea el primero y comparte su link."
              action={
                <Button onClick={() => openForm({ ...EMPTY })}>
                  <PanelIcon name="plus" />
                  Nuevo aliado
                </Button>
              }
            />
          </section>
        ) : (
          <ol className="grid gap-4">
            {ranked.map((p, i) => {
              const url = `${SITE}/a/${p.slug}`;
              const active = p.status === "active";
              return (
                <li key={p.id}>
                  <section aria-label={p.name} className="rounded-card border border-line bg-surface shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
                      <div className="min-w-0 flex-[1_1_320px]">
                        <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
                          <span className="num text-ink-3">#{i + 1}</span>
                          <span className="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>
                          <ToneBadge tone={active ? "ok" : "neutral"} dot>
                            {active ? "Activo" : "Pausado"}
                          </ToneBadge>
                        </h2>
                        <p className="mt-0.5 font-mono text-xs text-ink-2 [overflow-wrap:anywhere]">{url.replace("https://", "")}</p>
                        <p className="mt-0.5 text-xs text-ink-2">
                          {p.commissionRate > 0
                            ? `Comisión ${Math.round(p.commissionRate * 1000) / 10}% del fee · ${p.commissionDays} días por cliente`
                            : "Sin comisión"}
                          {p.clientFeePercent != null ? ` · Sus clientes pagan ${p.clientFeePercent}% de fee` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => void copy(url)}>
                          <PanelIcon name="copy" />
                          Copiar link
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openForm(toInput(p))}>
                          <PanelIcon name="pencil" />
                          Editar<span className="sr-only"> {p.name}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => setPartnerStatusAction(p.id, active ? "paused" : "active"),
                              active ? "Aliado pausado: su landing deja de funcionar." : "Aliado activado.",
                            )
                          }
                        >
                          {active ? "Pausar" : "Activar"}
                          <span className="sr-only"> {p.name}</span>
                        </Button>
                        <PartnerMenu
                          name={p.name}
                          items={[
                            ...(p.panelUrl
                              ? [
                                  {
                                    label: "Copiar link de su panel",
                                    hint: "Link privado: el aliado ve sus visitas, clientes y comisiones",
                                    icon: "link" as const,
                                    onSelect: () => void copy(p.panelUrl!),
                                  },
                                ]
                              : []),
                            {
                              label: "Asignar cliente",
                              icon: "user-plus",
                              disabled: pending,
                              onSelect: () => {
                                const email = window.prompt(`Correo del cliente que trajo ${p.name}:`);
                                if (!email) return;
                                run(() => assignClientToPartnerAction(p.id, email), "Cliente asignado al aliado.");
                              },
                            },
                            {
                              label: "Abrir su landing",
                              icon: "external",
                              onSelect: () => window.open(`/a/${p.slug}`, "_blank", "noreferrer"),
                            },
                          ]}
                        />
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
                      <dl className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                        <Mini label="Visitas 30 d" value={p.stats.visits30d} hint={`${p.stats.uniqueVisitors30d} únicas`} />
                        <Mini label="Visitas total" value={p.stats.visitsTotal} />
                        <Mini label="Registros" value={p.stats.signups} hint={`${pct(p.stats.signups, p.stats.uniqueVisitors30d)} de las únicas`} />
                        <Mini label="Pagan" value={p.stats.payingClients} hint={`${pct(p.stats.payingClients, p.stats.signups)} de registros`} />
                        <Mini label="Fee generado" value={usd(p.stats.feeCents)} />
                        <Mini label="Comisión" value={usd(p.stats.commissionPendingCents)} hint={`pagado ${usd(p.stats.commissionPaidCents)}`} />
                      </dl>

                      {p.stats.commissionPendingCents > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          disabled={pending}
                          onClick={() => {
                            const note = window.prompt(
                              `¿Marcar como pagados ${usd(p.stats.commissionPendingCents)} a ${p.name}? Escribe la referencia del pago:`,
                            );
                            if (note == null) return;
                            run(() => markPartnerCommissionsPaidAction(p.id, note), "Comisiones marcadas como pagadas.");
                          }}
                        >
                          <PanelIcon name="check" />
                          Marcar <span className="num">{usd(p.stats.commissionPendingCents)}</span> como pagado
                        </Button>
                      ) : null}
                    </div>
                  </section>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <PanelDialog
        open={form != null}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar ${form.name}` : "Nuevo aliado"}
        description="Se crea su página de registro con un link propio."
        closeLabel="Cerrar"
        size="wide"
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form={FORM_ID} disabled={pending}>
              {pending ? "Guardando…" : form?.id ? "Guardar cambios" : "Crear aliado"}
            </Button>
          </>
        }
      >
        {form ? (
          <form
            id={FORM_ID}
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => savePartnerAction(form), form.id ? "Aliado actualizado." : "Aliado creado. Ya puedes copiar su link.");
            }}
          >
            {error ? <Note tone="danger">{error}</Note> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre del aliado *">
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => (f ? { ...f, name, slug: f.id || f.slug !== slugify(f.name) ? f.slug : slugify(name) } : f));
                  }}
                  placeholder="Comunidad Ecom Pro"
                  required
                />
              </Field>
              <Field label="Link (adsholistic.com/a/…) *">
                <Input value={form.slug} onChange={(e) => update("slug", slugify(e.target.value))} placeholder="ecom-pro" required />
              </Field>
              <Field label="Título de la landing">
                <Input value={form.headline} onChange={(e) => update("headline", e.target.value)} placeholder="Lanza y escala tus campañas de TikTok" />
              </Field>
              <Field label="WhatsApp del aliado" optional>
                <Input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="51999888777" inputMode="tel" />
              </Field>
              <Field label="Subtítulo" wide>
                <Textarea
                  className="min-h-[72px]"
                  value={form.subheadline}
                  onChange={(e) => update("subheadline", e.target.value)}
                  placeholder="La comunidad Ecom Pro ya anuncia con Ads Holistic…"
                />
              </Field>
              <Field label="Logo (link https)">
                <Input value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://…/logo.png" />
              </Field>
              <Field label="Foto del aliado (link https)">
                <Input value={form.photoUrl} onChange={(e) => update("photoUrl", e.target.value)} placeholder="https://…/foto.jpg" />
              </Field>
              <Field label="Color de marca">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Elegir color de marca"
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-ctl border border-line bg-field p-1 shadow-ctl"
                    value={form.accentColor}
                    onChange={(e) => update("accentColor", e.target.value)}
                  />
                  <Input className="font-mono" value={form.accentColor} onChange={(e) => update("accentColor", e.target.value)} />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Comisión (% del fee)">
                  <Input type="number" min={0} max={50} step={0.5} value={form.commissionPercent} onChange={(e) => update("commissionPercent", Number(e.target.value))} />
                </Field>
                <Field label="Durante (días)">
                  <Input type="number" min={1} max={3650} value={form.commissionDays} onChange={(e) => update("commissionDays", Number(e.target.value))} />
                </Field>
              </div>
              <Field label="Fee de sus clientes (%)" optional wide>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={form.clientFeePercent ?? ""}
                  placeholder="Vacío = cada cliente con su fee normal"
                  onChange={(e) => update("clientFeePercent", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="Notas internas" wide>
                <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Acuerdo, contacto, forma de pago…" />
              </Field>
            </div>
          </form>
        ) : null}
      </PanelDialog>
    </div>
  );
}

/** Menú «más» de cada aliado: acciones de uso menos frecuente. */
function PartnerMenu({ name, items }: { name: string; items: PanelMenuItem[] }) {
  const { anchorRef, open, toggle, close } = usePopover();
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`Más acciones: ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="inline-grid size-8 place-items-center rounded-ctl border border-line bg-field text-ink shadow-ctl hover:border-line-strong hover:bg-hover"
      >
        <PanelIcon name="more" />
      </button>
      <PanelPopover anchorRef={anchorRef} open={open} onClose={close} label={`Más acciones: ${name}`} align="end" minWidth={220}>
        <PanelMenu
          label={`Más acciones: ${name}`}
          items={items.map((item) => ({
            ...item,
            onSelect: () => {
              close();
              item.onSelect();
            },
          }))}
        />
      </PanelPopover>
    </>
  );
}

function Field({ label, optional, wide, children }: { label: string; optional?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`grid min-w-0 gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 text-xs font-normal text-ink-3">(opcional)</span> : null}
      </span>
      {children}
    </label>
  );
}

/** Dato chico (v3 «mini»): rótulo en mayúsculas, cifra en monoespaciada y una nota. */
function Mini({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-box border border-line bg-field px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</dt>
      <dd className="num mt-0.5 text-[15px] font-semibold text-ink">{value}</dd>
      {hint ? <dd className="text-xs text-ink-3">{hint}</dd> : null}
    </div>
  );
}
