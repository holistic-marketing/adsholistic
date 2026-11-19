"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { PanelDialog } from "@/components/ui/PanelDialog.client";
import { PanelIcon } from "@/components/ui/PanelIcon";
import {
  Avatar,
  EmptyState,
  Note,
  PropList,
  SearchField,
  SquareIcon,
  StatCard,
  TabBar,
  ToneBadge,
  type Tone,
} from "@/components/ui/PanelKit";
import { PanelMenu, PanelPopover, usePopover } from "@/components/ui/PanelPopover.client";
import {
  CLIENT_REFERRAL_STAGES,
  formatAffiliateUsd,
  type ClientAffiliateProgramView,
  type ClientAffiliateReferral,
  type ClientAffiliateTab,
  type ClientReferralStage,
} from "@/features/affiliates/lib/client-program";

type Translator = ReturnType<typeof useTranslations<"affiliates.client">>;

const DATE_ZONE = "America/Lima";

const TABS: ClientAffiliateTab[] = ["referrals", "discounts", "how", "materials"];
const STEP_KEYS = ["share", "register", "contact", "close", "reward"] as const;

const STAGE_TONE: Record<ClientReferralStage, Tone> = {
  registered: "neutral",
  negotiating: "warn",
  contract_sent: "info",
  closed: "ok",
  declined: "danger",
};

export function ClientAffiliateDashboard({
  program,
  clienteName,
}: {
  program: ClientAffiliateProgramView;
  /** Ficha que se está viendo, para el rótulo del encabezado. */
  clienteName?: string;
}) {
  const t = useTranslations("affiliates.client");
  const tModule = useTranslations("affiliates");
  const locale = useLocale();
  const reward = formatAffiliateUsd(program.rewardUsd);
  const [tab, setTab] = useState<ClientAffiliateTab>("referrals");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<ClientReferralStage | "all">("all");
  const [copied, setCopied] = useState<"link" | "email" | "text" | null>(null);
  const [detail, setDetail] = useState<ClientAffiliateReferral | null>(null);

  const shareText = t("shareMessage", { url: program.shareUrl });
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return program.referrals.filter((row) => {
      if (stage !== "all" && row.stage !== stage) return false;
      if (!needle) return true;
      return [row.name, row.company, row.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [program.referrals, query, stage]);

  const discounts = program.referrals.filter((row) => row.earned);
  const showDeclined = program.referrals.some((row) => row.stage === "declined");

  async function copyValue(value: string, kind: "link" | "email" | "text") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="grid gap-4">
      {/* Encabezado (v3 «refhero»): la oferta a la izquierda y el premio al costado. */}
      <section className="grid overflow-hidden rounded-card border border-line bg-surface shadow-card md:grid-cols-[minmax(0,1.6fr)_minmax(220px,1fr)]">
        <div className="p-5 sm:p-6">
          {program.smoke ? (
            <div className="mb-3">
              <ToneBadge tone="warn" icon="alert">
                {t("smoke")}
              </ToneBadge>
              <p className="mt-1.5 text-xs text-ink-2">{t("smokeHint")}</p>
            </div>
          ) : null}
          <p className="eyebrow">{clienteName ? `${tModule("module")} · ${clienteName}` : tModule("module")}</p>
          <h1 tabIndex={-1} className="mt-1.5 text-2xl font-semibold leading-8 tracking-[-0.025em] text-ink outline-none">
            {t("heroTitle")}
          </h1>
          <p className="mt-1 max-w-[78ch] text-ink-2">
            {t("heroLead")}{" "}
            {t.rich("heroOffer", {
              reward,
              amount: (chunks) => <b className="font-semibold text-accent-text">{chunks}</b>,
              entry: (chunks) => <b className="font-semibold text-ink">{chunks}</b>,
            })}
          </p>
        </div>
        <div
          aria-hidden
          className="hidden content-center justify-items-center border-l border-line bg-field p-5 md:grid"
        >
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5">
            <SquareIcon icon="gift" tone="accent" />
            <b className="num text-2xl font-semibold tracking-[-0.03em] text-ink">+{reward}</b>
            <small className="col-start-2 text-xs text-ink-2">{t("rewardCardHint")}</small>
          </div>
        </div>
      </section>

      <PanelCard title={t("linkLabel")}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-0 flex-[1_1_260px] items-center gap-2 rounded-ctl border border-line bg-field py-1 pl-3 pr-1">
            <span aria-label={t("linkAria")} className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
              {program.displayPath}
            </span>
            <Button size="sm" onClick={() => copyValue(program.shareUrl, "link")}>
              <PanelIcon name={copied === "link" ? "check" : "link"} />
              {copied === "link" ? t("copied") : t("copy")}
            </Button>
          </div>
          <div role="group" aria-label={t("shareOn")} className="flex items-center gap-1.5">
            <span aria-hidden className="mr-1 text-xs text-ink-2">
              {t("shareOn")}
            </span>
            {/* Colores de cada red: son marcas ajenas. */}
            <ShareButton href={whatsappHref(shareText)} label={t("shareWhatsapp")} className="bg-[#25d366] text-white">
              <WhatsAppIcon />
            </ShareButton>
            <ShareButton
              href={telegramHref(program.shareUrl, shareText)}
              label={t("shareTelegram")}
              className="bg-[#2aa1df] text-white"
            >
              <TelegramIcon />
            </ShareButton>
            <ShareButton href={linkedinHref(program.shareUrl)} label={t("shareLinkedin")} className="bg-[#0a66c2] text-white">
              <LinkedInIcon />
            </ShareButton>
            <ShareButton
              href={emailHref(t("shareSubject"), shareText)}
              label={t("shareEmail")}
              className="border border-line bg-field text-ink shadow-ctl hover:bg-hover"
            >
              <MailIcon />
            </ShareButton>
          </div>
        </div>
      </PanelCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("statsTotal")} value={program.stats.total} />
        <StatCard label={t("statsClosed")} value={program.stats.closed} />
        <StatCard label={t("statsNegotiating")} value={program.stats.negotiating} />
        <StatCard label={t("statsEarned")} value={formatAffiliateUsd(program.stats.discountsEarnedUsd)} />
      </div>

      <section className="min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <TabBar
          label={tModule("module")}
          value={tab}
          onChange={setTab}
          className="px-4 sm:px-6"
          tabs={TABS.map((key) => ({
            value: key,
            label: t(`tabs.${key}`),
            count: key === "referrals" ? program.referrals.length : undefined,
          }))}
        />

        <div role="tabpanel" aria-label={t(`tabs.${tab}`)}>
          {tab === "referrals" ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
                <SearchField
                  label={t("searchAria")}
                  placeholder={t("search")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Select
                  value={stage}
                  onChange={(event) => setStage(event.target.value as ClientReferralStage | "all")}
                  aria-label={t("columns.status")}
                  className="w-auto"
                >
                  <option value="all">{t("filterAll")}</option>
                  {CLIENT_REFERRAL_STAGES.filter((item) => item !== "declined" || showDeclined).map((item) => (
                    <option key={item} value={item}>
                      {stageLabel(t, item)}
                    </option>
                  ))}
                </Select>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon="gift"
                  title={program.referrals.length === 0 ? t("emptyTitle") : t("emptyFilter")}
                  description={program.referrals.length === 0 ? t("emptyBody") : undefined}
                  action={
                    program.referrals.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQuery("");
                          setStage("all");
                        }}
                      >
                        {t("clearFilter")}
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <div className="overflow-x-auto p-2">
                  <table className="w-full min-w-[720px] border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0">
                    <thead>
                      <tr>
                        <Th className="w-10">{t("columns.index")}</Th>
                        <Th>{t("columns.name")}</Th>
                        <Th>{t("columns.date")}</Th>
                        <Th>{t("columns.status")}</Th>
                        <Th className="text-right">{t("columns.benefit")}</Th>
                        <Th className="w-px text-right">
                          <span className="sr-only">{t("columns.actions")}</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, index) => (
                        <tr key={row.id} className="hover:bg-field">
                          <Td className="num text-ink-3">{index + 1}</Td>
                          <Td>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar name={row.name} />
                              <div className="grid min-w-0 leading-snug">
                                <b className="truncate font-semibold text-ink">{row.name}</b>
                                {row.company && row.company !== row.name ? (
                                  <small className="truncate text-xs text-ink-3">{row.company}</small>
                                ) : null}
                              </div>
                            </div>
                          </Td>
                          <Td className="whitespace-nowrap text-ink-2">{formatReferralDate(row.registeredAt, locale)}</Td>
                          <Td>
                            <ToneBadge tone={STAGE_TONE[row.stage]} dot>
                              {stageLabel(t, row.stage)}
                            </ToneBadge>
                          </Td>
                          <Td className="whitespace-nowrap text-right">
                            <span className="num inline-flex items-center gap-1 font-semibold text-ink">
                              {formatAffiliateUsd(row.benefitUsd)}
                              {row.earned ? (
                                <span className="text-ok-fg" title={t("earnedMark")}>
                                  <PanelIcon name="check" className="size-3.5" />
                                  <span className="sr-only">{t("earnedMark")}</span>
                                </span>
                              ) : null}
                            </span>
                          </Td>
                          <Td className="whitespace-nowrap text-right">
                            <RowActions
                              row={row}
                              t={t}
                              emailCopied={copied === "email"}
                              onDetail={() => setDetail(row)}
                              onCopyEmail={() => void copyValue(row.email ?? "", "email")}
                            />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}

          {tab === "discounts" ? (
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <h2 className="text-base font-semibold text-ink">{t("discountsTitle")}</h2>
              <p className="mt-0.5 max-w-[78ch] text-[13px] text-ink-2">{t("discountsLead", { reward })}</p>
              {discounts.length === 0 ? (
                <p className="mt-4 text-ink-3">{t("discountsEmpty")}</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {discounts.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="grid min-w-0 leading-snug">
                        <b className="font-semibold text-ink [overflow-wrap:anywhere]">{row.name}</b>
                        <small className="text-xs text-ink-3">
                          {row.discountStatus === "applied" ? t("discountApplied") : t("discountPending")}
                          {row.appliedAt ? ` · ${formatReferralDate(row.appliedAt, locale)}` : ""}
                        </small>
                      </div>
                      <b className="num font-semibold text-ok-fg">{formatAffiliateUsd(row.benefitUsd)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === "how" ? (
            <div className="grid gap-5 px-4 pb-6 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <h2 className="text-base font-semibold text-ink">{t("howTitle")}</h2>
                <ol className="mt-3 grid gap-2.5">
                  {STEP_KEYS.map((key, index) => (
                    <li key={key} className="grid grid-cols-[22px_1fr] items-start gap-2.5 text-[13px] text-ink-2">
                      <StepNumber n={index + 1} />
                      <span className="pt-0.5">
                        <b className="font-semibold text-ink">{t(`steps.${key}.title`)}.</b> {t(`steps.${key}.body`)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-box border border-line bg-field p-4">
                <div className="flex items-center gap-2.5">
                  <SquareIcon icon="gift" tone="accent" />
                  <h3 className="text-sm font-semibold text-ink">{t("benefitTitle")}</h3>
                </div>
                <p className="mt-2.5 text-[13px] text-ink">{t("benefitLead", { reward })}</p>
                <ul className="mt-3 grid gap-2">
                  <BenefitItem>{t("benefitEntry")}</BenefitItem>
                  <BenefitItem>{t("benefitInvoice")}</BenefitItem>
                </ul>
              </div>
            </div>
          ) : null}

          {tab === "materials" ? (
            <div className="grid gap-3 px-4 pb-6 pt-4 sm:px-6">
              <div>
                <h2 className="text-base font-semibold text-ink">{t("materialsTitle")}</h2>
                <p className="mt-0.5 text-[13px] text-ink-2">{t("materialsLead")}</p>
              </div>
              <MaterialCard
                title={t("materialsShort")}
                body={t("materialsShortBody", { url: program.shareUrl })}
                action={copied === "text" ? t("textCopied") : t("copyText")}
                onCopy={() => copyValue(t("materialsShortBody", { url: program.shareUrl }), "text")}
              />
              <MaterialCard
                title={t("materialsPost")}
                body={t("materialsPostBody", { url: program.shareUrl, reward })}
                action={copied === "text" ? t("textCopied") : t("copyText")}
                onCopy={() => copyValue(t("materialsPostBody", { url: program.shareUrl, reward }), "text")}
              />
            </div>
          ) : null}
        </div>
      </section>

      <PanelDialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? t("detailTitle")}
        description={t("detailTitle")}
        closeLabel={t("detailClose")}
      >
        {detail ? (
          <div className="grid gap-4">
            {program.smoke ? <Note tone="warn">{t("detailSmoke")}</Note> : null}
            <PropList
              items={[
                { label: t("detailCompany"), value: detail.company ?? "—" },
                { label: t("detailEmail"), value: detail.email ?? "—" },
                { label: t("detailRegistered"), value: formatReferralDate(detail.registeredAt, locale) },
                {
                  label: t("detailStatus"),
                  value: (
                    <ToneBadge tone={STAGE_TONE[detail.stage]} dot>
                      {stageLabel(t, detail.stage)}
                    </ToneBadge>
                  ),
                },
                { label: t("detailBenefit"), value: <span className="num">{formatAffiliateUsd(detail.benefitUsd)}</span> },
              ]}
            />
            <div>
              <p className="eyebrow">{t("detailNext")}</p>
              <p className="mt-1 text-ink">{nextCopy(t, detail.stage)}</p>
            </div>
          </div>
        ) : null}
      </PanelDialog>
    </div>
  );
}

/** «Ver detalles» y un menú con el resto de acciones de la fila. */
function RowActions({
  row,
  t,
  emailCopied,
  onDetail,
  onCopyEmail,
}: {
  row: ClientAffiliateReferral;
  t: Translator;
  emailCopied: boolean;
  onDetail: () => void;
  onCopyEmail: () => void;
}) {
  const { anchorRef, open, toggle, close } = usePopover();
  return (
    <div className="inline-flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={onDetail}>
        {t("viewDetails")}
        <span className="sr-only">: {row.name}</span>
      </Button>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`${t("moreActions")}: ${row.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="inline-grid size-8 place-items-center rounded-ctl text-ink-2 hover:bg-hover hover:text-ink"
      >
        <PanelIcon name="more" />
      </button>
      <PanelPopover anchorRef={anchorRef} open={open} onClose={close} label={t("moreActions")} align="end">
        <PanelMenu
          label={t("moreActions")}
          items={[
            {
              label: t("viewDetails"),
              icon: "eye",
              onSelect: () => {
                close();
                onDetail();
              },
            },
            ...(row.email
              ? [
                  {
                    label: emailCopied ? t("emailCopied") : t("copyEmail"),
                    icon: "copy" as const,
                    onSelect: () => {
                      onCopyEmail();
                      close();
                    },
                  },
                ]
              : []),
          ]}
        />
      </PanelPopover>
    </div>
  );
}

function Th({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <th
      scope="col"
      className={`h-10 whitespace-nowrap border-b border-line px-2 text-left text-sm font-medium text-ink ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children: ReactNode }) {
  return <td className={`h-[59px] border-b border-line p-2 align-middle ${className ?? ""}`}>{children}</td>;
}

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden className="num grid size-[22px] place-items-center rounded-[6px] bg-subtle text-[11px] font-semibold text-ink">
      {n}
    </span>
  );
}

function stageLabel(t: Translator, stage: ClientReferralStage) {
  switch (stage) {
    case "registered":
      return t("stages.registered");
    case "negotiating":
      return t("stages.negotiating");
    case "contract_sent":
      return t("stages.contract_sent");
    case "closed":
      return t("stages.closed");
    case "declined":
      return t("stages.declined");
  }
}

function nextCopy(t: Translator, stage: ClientReferralStage) {
  switch (stage) {
    case "registered":
      return t("next.registered");
    case "negotiating":
      return t("next.negotiating");
    case "contract_sent":
      return t("next.contract_sent");
    case "closed":
      return t("next.closed");
    case "declined":
      return t("next.declined");
  }
}

function formatReferralDate(iso: string, locale: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DATE_ZONE,
  }).format(date);
}

function whatsappHref(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function telegramHref(url: string, text: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

function linkedinHref(url: string) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

function emailHref(subject: string, body: string) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function BenefitItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-[13px] text-ink">
      <PanelIcon name="check" className="mt-0.5 shrink-0 text-ok-fg" />
      <span>{children}</span>
    </li>
  );
}

function MaterialCard({
  title,
  body,
  action,
  onCopy,
}: {
  title: string;
  body: string;
  action: string;
  onCopy: () => void;
}) {
  return (
    <article className="flex gap-3 rounded-box border border-line bg-field p-4">
      <SquareIcon icon="megaphone" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-[13px] text-ink-2 [overflow-wrap:anywhere]">{body}</p>
        <button type="button" onClick={onCopy} className={buttonClass("outline", "sm", "mt-3")}>
          <PanelIcon name="copy" />
          {action}
        </button>
      </div>
    </article>
  );
}

function ShareButton({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-ctl ${className}`}
    >
      {children}
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 4.5A7.46 7.46 0 0 0 5.6 15.9L4.5 19.5l3.7-1.05A7.5 7.5 0 1 0 12.04 4.5Zm4.24 10.62c-.18.5-1.04.96-1.45 1.02-.37.06-.84.08-1.36-.08-.31-.1-.72-.23-1.24-.46-2.18-.94-3.6-3.14-3.71-3.29-.11-.14-.89-1.18-.89-2.25s.56-1.6.76-1.82c.2-.22.43-.27.58-.27h.41c.13 0 .31-.05.48.37.18.43.6 1.48.65 1.59.06.11.09.24.02.38-.08.14-.12.23-.23.35-.12.12-.24.27-.35.36-.11.1-.23.22-.1.43.14.2.6.99 1.29 1.6.89.79 1.64 1.04 1.87 1.15.23.12.37.1.5-.06.14-.16.58-.67.74-.9.15-.23.31-.19.52-.11.22.08 1.36.64 1.6.76.23.12.39.18.44.28.06.1.06.58-.12 1.08Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg aria-hidden className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.8 5.4 4.9 11.1c-1 .4-1 .97-.2 1.22l3.82 1.19 1.47 4.5c.18.5.09.7.62.7.32 0 .46-.15.64-.33l2.05-2 4.26 3.15c.78.43 1.34.21 1.53-.73l2.77-13.1c.28-1.14-.44-1.66-1.16-1.3Zm-2.3 3.02-7.2 6.55-.28 2.95-1.1-3.66 8.58-5.84Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.5 9.5H4V20h2.5V9.5ZM5.24 4A1.46 1.46 0 1 0 5.26 7a1.46 1.46 0 0 0-.02-3ZM20 20h-2.5v-5.6c0-1.55-.56-2.6-1.95-2.6-1.06 0-1.7.72-1.98 1.41-.1.25-.13.6-.13.95V20H11V9.5h2.4v1.44c.36-.58 1.14-1.64 2.86-1.64 2.09 0 3.74 1.37 3.74 4.32V20Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" />
    </svg>
  );
}
