"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { DashboardModalShell } from "@/components/ui/DashboardModalShell.client";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { AdAccount, AdAccountPlatform, AdAccountStatus } from "@/types/ad-account";

interface ConfigureAdAccountModalProps {
  account: AdAccount;
  onClose: () => void;
}

export function ConfigureAdAccountModal({
  account,
  onClose,
}: ConfigureAdAccountModalProps) {
  const t = useTranslations("adAccounts");
  const tCommon = useTranslations("common");
  const fieldId = useId();
  const router = useRouter();
  const [name, setName] = useState(account.name);
  const [platform, setPlatform] = useState<AdAccountPlatform>(account.platform);
  const [status, setStatus] = useState<Exclude<AdAccountStatus, "archived">>(
    account.status === "archived" ? "disabled" : account.status,
  );
  const [externalBusinessId, setExternalBusinessId] = useState(account.externalBusinessId ?? "");
  const [externalAccountId, setExternalAccountId] = useState(account.externalAccountId ?? "");
  const [externalAccountName, setExternalAccountName] = useState(account.externalAccountName ?? "");
  const [timezone, setTimezone] = useState(account.timezone);
  const [dailyBudget, setDailyBudget] = useState(String(account.dailyBudget || ""));
  const [monthlyLimit, setMonthlyLimit] = useState(String(account.monthlyLimit || ""));
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(account.autoRecharge);
  const [rechargeThreshold, setRechargeThreshold] = useState(String(account.rechargeThreshold || ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platforms: { value: AdAccountPlatform; label: string }[] = [
    { value: "meta", label: "Meta" },
    { value: "tiktok", label: "TikTok" },
    { value: "google", label: "Google" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "other", label: t("createModal.other") },
  ];

  const statuses: { value: Exclude<AdAccountStatus, "archived">; label: string }[] = [
    { value: "active", label: t("status.active") },
    { value: "pending", label: t("status.pending") },
    { value: "disabled", label: t("status.disabled") },
    { value: "review", label: t("status.review") },
  ];

  function parseAmount(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t("configureModal.nameRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient(`/api/ad-accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          platform,
          status,
          externalBusinessId,
          externalAccountId,
          externalAccountName,
          timezone,
          dailyBudget: parseAmount(dailyBudget),
          monthlyLimit: parseAmount(monthlyLimit),
          autoRechargeEnabled,
          rechargeThreshold: parseAmount(rechargeThreshold),
        }),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("configureModal.saveError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardModalShell open onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink">
        {t("configureModal.title")}
      </h2>
      <p className="mt-1 text-[13px] text-ink-2">
        {t("configureModal.subtitle")}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${fieldId}-1`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("configureModal.name")}
          </label>
          <Input id={`${fieldId}-1`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${fieldId}-2`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("createModal.platform")}
          </label>
          <Select
            id={`${fieldId}-2`}
            value={platform}
            onChange={(e) => setPlatform(e.target.value as AdAccountPlatform)}
          >
            {platforms.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${fieldId}-3`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("configureModal.status")}
          </label>
          <Select
            id={`${fieldId}-3`}
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as Exclude<AdAccountStatus, "archived">)
            }
          >
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${fieldId}-4`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("createModal.bcId")}
          </label>
          <Input
            id={`${fieldId}-4`}
            value={externalBusinessId}
            onChange={(e) => setExternalBusinessId(e.target.value)}
            placeholder={t("configureModal.bcPlaceholder")}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-5`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("configureModal.advertiserId")}
          </label>
          <Input
            id={`${fieldId}-5`}
            value={externalAccountId}
            onChange={(e) => setExternalAccountId(e.target.value)}
            placeholder={t("configureModal.advertiserPlaceholder")}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${fieldId}-6`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("createModal.externalName")}
          </label>
          <Input
            id={`${fieldId}-6`}
            value={externalAccountName}
            onChange={(e) => setExternalAccountName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-7`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("createModal.timezone")}
          </label>
          <Input id={`${fieldId}-7`} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${fieldId}-8`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("createModal.dailyBudget")}
          </label>
          <Input
            id={`${fieldId}-8`}
            type="number"
            min="0"
            step="0.01"
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-9`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("createModal.monthlyLimit")}
          </label>
          <Input
            id={`${fieldId}-9`}
            type="number"
            min="0"
            step="0.01"
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-10`} className="mb-1.5 block text-sm font-medium text-ink">
            {t("createModal.threshold")}
          </label>
          <Input
            id={`${fieldId}-10`}
            type="number"
            min="0"
            step="0.01"
            value={rechargeThreshold}
            onChange={(e) => setRechargeThreshold(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 rounded-box border border-line bg-field p-3 text-sm font-medium text-ink sm:col-span-2">
          <input
            type="checkbox"
            checked={autoRechargeEnabled}
            onChange={(e) => setAutoRechargeEnabled(e.target.checked)}
            className="size-4 accent-accent-btn"
          />
          {t("configureModal.autoRecharge")}
        </label>
      </div>

      {error && (
        <p className="mt-3 text-xs text-danger-fg" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {tCommon("cancel")}
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? t("configureModal.saving") : tCommon("save")}
        </Button>
      </div>
    </DashboardModalShell>
  );
}
