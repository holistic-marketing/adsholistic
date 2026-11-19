import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import { buttonClass } from "@/components/ui/Button";
import { HelpGuide } from "@/components/ui/HelpGuide.client";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { EmptyState, ToneBadge } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { CopyTextButton } from "@/features/creative-analyzer/components/CopyTextButton.client";
import { CreativeUploadPanel } from "@/features/creative-analyzer/components/CreativeUploadPanel.client";
import { CreativeAssetsPanel } from "@/features/creative-analyzer/components/CreativeAssetsPanel.client";
import { AgentProDraftsPanel } from "@/features/creative-analyzer/components/AgentProDraftsPanel.client";
import { CreativePipelineStrip } from "@/features/creative-analyzer/components/CreativePipelineStrip.client";
import { TikTokVideoGallery } from "@/features/creative-analyzer/components/TikTokVideoGallery";
import { VideoStudioPanel } from "@/features/creative-analyzer/components/VideoStudioPanel.client";
import { LaunchCampaignPanel } from "@/features/campaigns/components/LaunchCampaignPanel.client";
import { CampaignBriefPanel } from "@/features/campaigns/components/CampaignBriefPanel.client";
import { LaunchedCampaignsPanel } from "@/features/campaigns/components/LaunchedCampaignsPanel.client";
import type {
  HecomClienteDashboard,
  HecomCreativoCliente,
  HecomCreativoProyecto,
} from "@/lib/hecom/cliente-dashboard.server";
import type {
  CreativeAccountOption,
  CreativeAssetListItem,
  CreativeDraftListItem,
} from "@/lib/creatives/types";
import { latestPolicyOrClaimsKind } from "@/lib/creatives/tiktok-reject-action";
import { cn } from "@/lib/cn";

function platformLabel(platform: string | null) {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.includes("tiktok")) return "TikTok";
  if (p.includes("meta") || p.includes("facebook") || p.includes("ig")) return "Meta";
  if (p.includes("google") || p.includes("youtube")) return "Google";
  return platform;
}

function resolveActiveStep(input: {
  assets: CreativeAssetListItem[];
  drafts: CreativeDraftListItem[];
}): 0 | 1 | 2 | 3 {
  const hasUpload = input.assets.length > 0;
  const hasScore = input.assets.some((a) => a.insight);
  const hasDraft = input.drafts.length > 0;
  const hasLaunch = input.drafts.some(
    (d) => d.status === "approved" || d.status === "published" || d.status === "publishing",
  );
  if (hasLaunch) return 3;
  if (hasDraft) return 2;
  if (hasScore) return 1;
  if (hasUpload) return 1;
  return 0;
}

/** Fila de cifras pegadas (v3 «stats flush»): una sola caja con divisiones finas. */
function StatStrip({ items }: { items: Array<{ label: string; value: string; tone?: "danger" }> }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-box border border-line bg-line shadow-card lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-surface px-4 py-3.5">
          <dt className="text-sm font-medium text-ink-2">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] tabular-nums",
              item.tone === "danger" ? "text-danger-fg" : "text-ink",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Creative Hub (v3): subir, puntuar, armar el brief y enviar la campaña en pausa. */
export async function CreativeHub({
  data,
  accounts,
  assets,
  drafts,
  publishEnabled,
  expectDiscoverRefresh = false,
  organizationId,
  showVideoStudio = false,
}: {
  data: HecomClienteDashboard;
  accounts: CreativeAccountOption[];
  assets: CreativeAssetListItem[];
  drafts: CreativeDraftListItem[];
  publishEnabled: boolean;
  /** Un refresco suave para que llegue el descubrimiento de TikTok en segundo plano. */
  expectDiscoverRefresh?: boolean;
  organizationId?: string;
  /** "Crear video" por ahora es solo para el equipo. */
  showVideoStudio?: boolean;
}) {
  const t = await getTranslations("creatives");
  const h = await getTranslations("help");
  const { cliente, creativosClientes, creativosProyectos } = data;
  const analyzed = assets.filter((a) => a.insight).length;
  const pendingDrafts = drafts.filter((d) => d.status === "draft" || d.status === "failed").length;
  const tiktokProblems = drafts.filter(
    (d) => d.status === "published" && d.tiktokReviewStatus === "rejected",
  ).length;
  const activeStep = resolveActiveStep({ assets, drafts });
  const avgScore =
    analyzed > 0
      ? Math.round(
          assets.filter((a) => a.insight).reduce((sum, a) => sum + (a.insight?.overallScore ?? 0), 0) / analyzed,
        )
      : null;

  const repeatRejectKind = latestPolicyOrClaimsKind(
    drafts
      .filter((d) => d.status === "published" && d.tiktokReviewStatus === "rejected")
      .map((d) => ({ reasons: d.tiktokRejectReasons, at: d.publishedAt ?? d.createdAt })),
  );

  return (
    <div>
      <PageHeader
        eyebrow={`${t("module")} · ${cliente.name}`}
        title={t("title")}
        lede={t("hub.lede")}
        actions={
          <>
            <Link href="#creative-upload" className={buttonClass("primary")}>
              <PanelIcon name="upload" />
              {t("uploadVideo")}
            </Link>
            {showVideoStudio ? (
              <Link href="#video-studio" className={buttonClass("outline")}>
                <PanelIcon name="video" />
                {t("createVideo")}
              </Link>
            ) : null}
            <Link href="#campaign-brief" className={buttonClass("outline")}>
              <PanelIcon name="sparkle" />
              {t("campaignBrief")}
            </Link>
            <Link href="#launch-campaign" className={buttonClass("outline")}>
              <PanelIcon name="send" />
              {t("launchCampaign")}
            </Link>
            <Link href={routes.adAccounts} className={buttonClass("outline")}>
              <PanelIcon name="layers" />
              {t("tiktokAccounts")}
            </Link>
          </>
        }
      />

      <div className="grid gap-4">
        <div>
          <CreativePipelineStrip activeStep={activeStep} />
          <HelpGuide
            className="mt-2"
            summary={h("creatives.summary")}
            intro={h("creatives.intro")}
            steps={[h("creatives.step1"), h("creatives.step2"), h("creatives.step3"), h("creatives.step4")]}
            time={h("creatives.time")}
            tip={h("creatives.tip")}
            faqTitle={h("faqTitle")}
            faq={(["whyRejected", "appeal", "score", "paused"] as const).map((id) => ({
              q: h(`creatives.faq.${id}.q`),
              a: h(`creatives.faq.${id}.a`),
            }))}
          />
        </div>

        <StatStrip
          items={[
            { label: t("hub.uploads"), value: String(assets.length) },
            { label: t("hub.scoreAvg"), value: avgScore != null ? String(avgScore) : "—" },
            { label: t("metrics.pendingApprove"), value: String(pendingDrafts) },
            {
              label: t("metrics.tiktokProblems"),
              value: String(tiktokProblems),
              tone: tiktokProblems > 0 ? "danger" : undefined,
            },
          ]}
        />

        {/* Lo que hay que resolver primero: rechazados y por enviar. */}
        <AgentProDraftsPanel
          drafts={drafts}
          publishEnabled={publishEnabled}
          expectDiscoverRefresh={expectDiscoverRefresh}
        />

        {/* Videos que ya corren en TikTok: se carga aparte para no frenar la página. */}
        <Suspense fallback={<PanelSkeleton className="h-64" />}>
          <TikTokVideoGallery clienteId={cliente.id} organizationId={organizationId} />
        </Suspense>

        <Suspense fallback={<PanelSkeleton id="creative-upload" className="h-48" />}>
          <CreativeUploadPanel clienteName={cliente.name} accounts={accounts} repeatRejectKind={repeatRejectKind} />
        </Suspense>

        <CampaignBriefPanel showVideoStudio={showVideoStudio} />
        {showVideoStudio ? <VideoStudioPanel clienteName={cliente.name} accounts={accounts} /> : null}
        <LaunchCampaignPanel clienteName={cliente.name} accounts={accounts} />
        <LaunchedCampaignsPanel />

        <CreativeAssetsPanel assets={assets} />

        <div className="flex flex-wrap gap-2">
          {[
            { href: routes.overview, label: t("quickLinks.overview"), icon: "gauge" as const },
            { href: routes.adAccounts, label: t("quickLinks.adAccounts"), icon: "layers" as const },
            { href: routes.payments, label: t("quickLinks.payments"), icon: "wallet" as const },
          ].map((link) => (
            <Link key={link.href} href={link.href} className={buttonClass("outline", "sm")}>
              <PanelIcon name={link.icon} />
              {link.label}
              <PanelIcon name="arrow-right" className="text-ink-3" />
            </Link>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <FichasPanel rows={creativosClientes} />
          <ProyectosPanel rows={creativosProyectos} />
        </div>
      </div>
    </div>
  );
}

function PanelSkeleton({ id, className }: { id?: string; className: string }) {
  return (
    <div
      id={id}
      aria-hidden
      className={cn("animate-pulse rounded-card border border-line bg-surface motion-reduce:animate-none", className)}
    />
  );
}

function ScrollList({ children }: { children: ReactNode }) {
  return <ul className="max-h-[24rem] divide-y divide-line overflow-y-auto">{children}</ul>;
}

async function FichasPanel({ rows }: { rows: HecomCreativoCliente[] }) {
  const t = await getTranslations("creatives");
  return (
    <PanelCard title={t("ficha.title")} description={t("ficha.contactsSubtitle", { count: rows.length })} ruled>
      {rows.length === 0 ? (
        <EmptyState icon="user" title={t("ficha.empty")} className="py-8" />
      ) : (
        <ScrollList>
          {rows.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <p className="truncate font-semibold text-ink">{item.name}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-3">
                {item.company ? <span>{item.company}</span> : null}
                {item.email ? <span className="min-w-0 break-all">{item.email}</span> : null}
              </p>
              {item.email ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <Link
                    href={`mailto:${item.email}?subject=${encodeURIComponent(t("ficha.emailSubject", { name: item.name }))}`}
                    className="text-xs font-medium text-accent-text underline-offset-[3px] hover:underline"
                  >
                    {t("ficha.writeEmail")}
                  </Link>
                  <CopyTextButton value={item.email} label={t("ficha.copyEmail")} />
                </div>
              ) : null}
            </li>
          ))}
        </ScrollList>
      )}
    </PanelCard>
  );
}

async function ProyectosPanel({ rows }: { rows: HecomCreativoProyecto[] }) {
  const t = await getTranslations("creatives");
  return (
    <PanelCard title={t("proyectos.title")} description={t("proyectos.subtitle")} ruled>
      {rows.length === 0 ? (
        <EmptyState
          icon="layers"
          title={t("proyectos.empty")}
          className="py-8"
          action={
            <Link href="#creative-upload" className={buttonClass("outline", "sm")}>
              <PanelIcon name="upload" />
              {t("proyectos.goUpload")}
            </Link>
          }
        />
      ) : (
        <ScrollList>
          {rows.map((row) => {
            const platform = platformLabel(row.platform);
            return (
              <li key={row.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{row.name}</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {[row.type, platform, row.format].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ToneBadge tone={row.published ? "ok" : "neutral"} dot>
                  {row.published ? t("proyectos.published") : t("proyectos.draft")}
                </ToneBadge>
              </li>
            );
          })}
        </ScrollList>
      )}
    </PanelCard>
  );
}
