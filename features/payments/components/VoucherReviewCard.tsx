import { cn } from "@/lib/cn";
import { PanelIcon, type PanelIconName } from "@/components/ui/PanelIcon";
import { Note } from "@/components/ui/PanelKit";
import {
  formatChargeAmount,
  type VoucherReviewKind,
  type VoucherReviewNotice,
} from "@/lib/payments/voucher-review-notice";

/**
 * Tarjeta que ve el cliente cuando su comprobante no se acreditó solo.
 * Rojo para lo que el cliente hizo distinto (monto, cuenta, no es boleta);
 * ámbar para una revisión normal.
 */

const TONE: Record<VoucherReviewKind, "danger" | "warn"> = {
  amount_mismatch: "danger",
  destination_mismatch: "danger",
  not_receipt: "danger",
  duplicate: "danger",
  unreadable: "warn",
  review: "warn",
};

const ICON: Record<VoucherReviewKind, PanelIconName> = {
  amount_mismatch: "file",
  destination_mismatch: "bank",
  not_receipt: "x-circle",
  unreadable: "eye",
  duplicate: "copy",
  review: "clock",
};

export function VoucherReviewCard({ notice }: { notice: VoucherReviewNotice }) {
  const showAmounts =
    notice.kind === "amount_mismatch" &&
    notice.enteredAmount != null &&
    notice.voucherAmount != null &&
    notice.currency != null;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-box border border-[var(--t-line)] bg-[var(--t-bg)] p-4",
          `tone-${TONE[notice.kind]}`,
        )}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-box bg-surface text-[var(--t-fg)] shadow-ctl"
          >
            <PanelIcon name={ICON[notice.kind]} className="size-5!" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--t-fg)]">{notice.title}</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--t-fg)]">{notice.message}</p>
          </div>
        </div>

        {showAmounts ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-ctl border border-[var(--t-line)] bg-surface px-3 py-2.5">
              <p className="text-xs font-medium text-ink-3">Monto que ingresaste</p>
              <p className="num mt-0.5 text-base font-semibold text-ink line-through decoration-danger-fg">
                {formatChargeAmount(notice.enteredAmount!, notice.currency!)}
              </p>
            </div>
            <div className="rounded-ctl border border-[var(--t-line)] bg-surface px-3 py-2.5">
              <p className="text-xs font-medium text-ink-3">Monto en tu boleta</p>
              <p className="num mt-0.5 text-base font-semibold text-ink">
                {formatChargeAmount(notice.voucherAmount!, notice.currency!)}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <Note tone="neutral" icon="chat">
        <span className="font-semibold text-ink">Soporte ya tiene tu caso.</span> Te avisaremos por aquí y por
        correo. No vuelvas a pagar.
      </Note>

      {notice.tip ? (
        <p className="px-1 text-xs leading-5 text-ink-2">
          <span className="font-semibold text-ink">Para la próxima: </span>
          {notice.tip.replace(/^Para la próxima,\s*/i, "").replace(/^./, (c) => c.toUpperCase())}
        </p>
      ) : null}
    </div>
  );
}
