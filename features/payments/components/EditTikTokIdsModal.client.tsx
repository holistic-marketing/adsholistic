"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DashboardModalShell } from "@/components/ui/DashboardModalShell.client";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PropList } from "@/components/ui/PanelKit";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { PaymentAccountAllocation } from "@/types/payment";
import {
  PaymentFieldError,
  PaymentFieldHint,
  PaymentFieldLabel,
} from "./PaymentDialog";

const BRANLYN_206 = "7655330910371594258";
const BM_200_BC = "7575005779271614480";

interface EditTikTokIdsModalProps {
  account: PaymentAccountAllocation | null;
  open: boolean;
  onClose: () => void;
}

/** Edita advertiser/BC de la cuenta Holistic usada al fondear (Pagos). */
export function EditTikTokIdsModal({
  account,
  open,
  onClose,
}: EditTikTokIdsModalProps) {
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const fieldId = useId();
  const router = useRouter();
  const [advertiserId, setAdvertiserId] = useState(
    account?.externalAccountId ?? "",
  );
  const [bcId, setBcId] = useState(BM_200_BC);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !account) return null;

  async function handleSave() {
    const adv = advertiserId.trim();
    if (!adv) {
      setError(t("editTikTok.errRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient(`/api/ad-accounts/${account!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          externalAccountId: adv,
          externalBusinessId: bcId.trim() || null,
          name: account!.name.includes("206")
            ? account!.name
            : account!.name.replace("204.0", "206.0").replace("204,0", "206,0"),
        }),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("editTikTok.errSave"));
    } finally {
      setLoading(false);
    }
  }

  return (
    // El marco común ya pone el portal, Esc y el bloqueo de scroll; adentro va
    // la misma cabecera, cuerpo y pie de los diálogos v3.
    <DashboardModalShell open onClose={onClose} maxWidthClassName="max-w-[512px]">
      <header className="-mr-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-6 tracking-[-0.015em] text-ink">
            {t("editTikTok.title")}
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {t("editTikTok.bodyBefore")}{" "}
            <span className="font-medium text-ink">
              {t("editTikTok.approved")}
            </span>{" "}
            {t("editTikTok.bodyAfter")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon("close")}
          className="-mt-2 inline-grid size-8 shrink-0 place-items-center rounded-ctl text-ink hover:bg-hover"
        >
          <PanelIcon name="x" />
        </button>
      </header>

      <div className="mt-4 space-y-4">
        <PropList
          items={[{ label: t("allocateModal.account"), value: account.name }]}
        />
        <div>
          <PaymentFieldLabel htmlFor={`${fieldId}-1`}>
            {t("editTikTok.advertiserLabel")}
          </PaymentFieldLabel>
          <Input
            id={`${fieldId}-1`}
            value={advertiserId}
            onChange={(e) => setAdvertiserId(e.target.value)}
            placeholder="7655330910371594258"
            className="font-mono text-[13px]"
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          <button
            type="button"
            className="mt-1.5 text-xs font-medium text-accent-text underline-offset-2 hover:underline"
            onClick={() => setAdvertiserId(BRANLYN_206)}
          >
            {t("editTikTok.useBranlyn")}
          </button>
        </div>
        <div>
          <PaymentFieldLabel htmlFor={`${fieldId}-2`}>
            {t("editTikTok.bcLabel")}
          </PaymentFieldLabel>
          <Input
            id={`${fieldId}-2`}
            value={bcId}
            onChange={(e) => setBcId(e.target.value)}
            placeholder={BM_200_BC}
            className="font-mono text-[13px]"
          />
          <PaymentFieldHint className="font-mono">
            {t("editTikTok.bmHint", { id: BM_200_BC })}
          </PaymentFieldHint>
        </div>
        {error ? <PaymentFieldError>{error}</PaymentFieldError> : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {tCommon("cancel")}
        </Button>
        <Button onClick={() => void handleSave()} disabled={loading}>
          {loading ? t("editTikTok.saving") : t("editTikTok.save")}
        </Button>
      </div>
    </DashboardModalShell>
  );
}
