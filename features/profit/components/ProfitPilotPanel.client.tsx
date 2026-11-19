"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { PanelCard } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import { moneyUsd } from "@/lib/format/money-usd";
import type { PilotProposal } from "@/lib/radar/pilot";

/**
 * Piloto (Fase 5 del Radar) dentro de Profit: propuestas sobre los anuncios
 * del cliente. Nada cambia hasta que el cliente confirma; la única acción
 * ejecutable es pausar un anuncio que pierde (reversible).
 */

type PilotResponse = {
  proposals: PilotProposal[];
  averageCostPerResult: number | null;
  dataThrough: string | null;
  actionsEnabled: boolean;
  canAct: boolean;
};

/* Punto de color de cada propuesta. */
const TONE: Record<PilotProposal["kind"], Tone> = {
  pause_loser_same_group: "accent",
  pause_loser: "accent",
  scale_winner: "ok",
  refresh_fatigued: "accent",
  all_losing: "danger",
};

function money(value: number | null) {
  return value == null ? "—" : moneyUsd(value);
}

type PilotT = ReturnType<typeof useTranslations<"profit.pilot">>;

/** Título, texto y acciones de cada propuesta. */
function describeProposal(p: PilotProposal, t: PilotT) {
  const avg = money(p.kind === "all_losing" || p.kind === "refresh_fatigued" ? null : p.averageCostPerResult);
  let title = "";
  let body = "";
  let pauseName: string | null = null;
  let toRadar = false;
  switch (p.kind) {
    case "pause_loser_same_group":
      pauseName = p.loser.adName;
      title = t("kinds.pause_loser_same_group.title", { loser: p.loser.adName });
      body =
        p.loserCostPerResult == null
          ? t("kinds.pause_loser_same_group.bodyNoResults", {
              winner: p.winner.adName,
              loser: p.loser.adName,
              winnerCpr: money(p.winnerCostPerResult),
            })
          : t("kinds.pause_loser_same_group.body", {
              winner: p.winner.adName,
              loser: p.loser.adName,
              winnerCpr: money(p.winnerCostPerResult),
              loserCpr: money(p.loserCostPerResult),
            });
      break;
    case "pause_loser":
      pauseName = p.loser.adName;
      title = t("kinds.pause_loser.title", { loser: p.loser.adName });
      body =
        p.loserCostPerResult == null
          ? t("kinds.pause_loser.bodyNoResults", { spend: money(p.loserSpend) })
          : t("kinds.pause_loser.body", { loserCpr: money(p.loserCostPerResult), avg });
      break;
    case "scale_winner":
      title = t("kinds.scale_winner.title", { winner: p.winner.adName });
      body = t("kinds.scale_winner.body", { pct: p.cheaperPct, max: p.maxIncreasePct });
      break;
    case "refresh_fatigued":
      toRadar = true;
      title = t("kinds.refresh_fatigued.title", { ad: p.ad.adName });
      body = t("kinds.refresh_fatigued.body", { pct: p.ctrDropPct });
      break;
    case "all_losing":
      toRadar = true;
      title = t("kinds.all_losing.title");
      body = t("kinds.all_losing.body");
      break;
  }
  return { title, body, pauseName, toRadar };
}

export function ProfitPilotPanel() {
  const t = useTranslations("profit.pilot");
  const [data, setData] = useState<PilotResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; text: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profit/pilot", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as PilotResponse;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  async function act(proposal: PilotProposal, action: "pause" | "dismiss", name?: string) {
    setBusy(proposal.id);
    setNotice(null);
    try {
      const res = await fetch("/api/profit/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, action }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || String(res.status));
      setData((prev) => (prev ? { ...prev, proposals: prev.proposals.filter((p) => p.id !== proposal.id) } : prev));
      if (action === "pause" && name) setNotice({ id: proposal.id, text: t("actions.done", { name }), tone: "ok" });
    } catch (error) {
      setNotice({ id: proposal.id, text: error instanceof Error ? error.message : t("error"), tone: "error" });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  // Sin datos guardados todavía, la sección no se muestra.
  if (!loadFailed && data && data.dataThrough == null) return null;

  return (
    <PanelCard
      aria-busy={!data && !loadFailed}
      title={t("title")}
      description={t("subtitle")}
      action={
        data?.averageCostPerResult != null ? (
          <ToneBadge className="num">{t("average", { amount: moneyUsd(data.averageCostPerResult) })}</ToneBadge>
        ) : null
      }
    >
      {notice && notice.tone === "ok" ? (
        <div role="status" className="mb-3">
          <Note tone="ok" icon="check-circle">
            {notice.text}
          </Note>
        </div>
      ) : null}

      {loadFailed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
          {t("error")}
          <button type="button" onClick={() => setReloadToken((n) => n + 1)} className={buttonClass("outline", "sm")}>
            <PanelIcon name="refresh" />
            {t("retry")}
          </button>
        </div>
      ) : !data ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-box bg-subtle motion-reduce:animate-none" />
          ))}
        </div>
      ) : data.proposals.length === 0 ? (
        <p className="text-[13px] text-ink-2">{t("empty")}</p>
      ) : (
        <ul>
          {data.proposals.map((p) => {
            const { title, body, pauseName, toRadar } = describeProposal(p, t);
            const isConfirming = confirming === p.id;
            const isBusy = busy === p.id;
            return (
              <li key={p.id} className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-1">
                <div className="flex gap-3">
                  <span aria-hidden className={cn("mt-[7px] size-2 shrink-0 rounded-full bg-[var(--t-solid)]", `tone-${TONE[p.kind]}`)} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">{title}</h3>
                    <p className="mt-0.5 max-w-[68ch] text-[13px] leading-[1.55] text-ink-2 [overflow-wrap:anywhere]">{body}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-5">
                  {pauseName && data.canAct && data.actionsEnabled ? (
                    isConfirming ? (
                      <>
                        <span className="text-[13px] text-ink-2">{t("actions.confirmText")}</span>
                        <button
                          type="button"
                          className={buttonClass("primary", "sm")}
                          disabled={isBusy}
                          onClick={() => void act(p, "pause", pauseName!)}
                        >
                          {t("actions.confirm")}
                        </button>
                        <button type="button" className={buttonClass("outline", "sm")} disabled={isBusy} onClick={() => setConfirming(null)}>
                          {t("actions.cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={buttonClass("primary", "sm", "max-w-full")}
                        onClick={() => setConfirming(p.id)}
                        title={t("actions.pause", { name: pauseName })}
                      >
                        <PanelIcon name="pause-circle" />
                        <span className="truncate">{t("actions.pause", { name: pauseName })}</span>
                      </button>
                    )
                  ) : null}
                  {toRadar ? (
                    <Link href={`${routes.profit}/radar`} className={buttonClass("outline", "sm")}>
                      {t("actions.toRadar")}
                    </Link>
                  ) : null}
                  {data.canAct && !isConfirming ? (
                    <button type="button" className={buttonClass("ghost", "sm")} disabled={isBusy} onClick={() => void act(p, "dismiss")}>
                      {t("actions.dismiss")}
                    </button>
                  ) : null}
                  {pauseName && !data.canAct ? <span className="text-xs text-ink-3">{t("actions.viewOnly")}</span> : null}
                  {pauseName && data.canAct && !data.actionsEnabled ? (
                    <span className="text-xs text-ink-3">{t("actions.actionsOff")}</span>
                  ) : null}
                </div>
                {notice && notice.id === p.id && notice.tone === "error" ? (
                  <Note tone="danger" className="ml-5">
                    {notice.text}
                  </Note>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">{t("rules")}</p>
    </PanelCard>
  );
}
