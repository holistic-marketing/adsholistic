import {
  formatChargeAmount,
  type VoucherReviewKind,
  type VoucherReviewNotice,
} from "@/lib/payments/voucher-review-notice";

/**
 * Tarjeta que ve el cliente cuando su comprobante no se acreditó solo.
 * Rojo suave para lo que el cliente hizo distinto (monto, cuenta, no es boleta);
 * ámbar para una revisión normal.
 */

const TONE: Record<VoucherReviewKind, "error" | "warn"> = {
  amount_mismatch: "error",
  destination_mismatch: "error",
  not_receipt: "error",
  duplicate: "error",
  unreadable: "warn",
  review: "warn",
};

function KindIcon({ kind }: { kind: VoucherReviewKind }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "amount_mismatch":
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6M9 17h3" />
        </svg>
      );
    case "destination_mismatch":
      return (
        <svg {...common}>
          <path d="M3 10 12 4l9 6" />
          <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
        </svg>
      );
    case "not_receipt":
    case "unreadable":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m3 15 5-5 4 4 3-3 6 6" />
          <path d="M4 4 20 20" />
        </svg>
      );
    case "duplicate":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
  }
}

export function VoucherReviewCard({ notice }: { notice: VoucherReviewNotice }) {
  const tone = TONE[notice.kind];
  const palette =
    tone === "error"
      ? {
          box: "border-danger-line bg-danger-bg/70",
          icon: "bg-danger-bg text-danger-fg",
          title: "text-danger-fg",
          text: "text-danger-fg/80",
        }
      : {
          box: "border-warn-line bg-warn-bg/70",
          icon: "bg-warn-bg text-warn-fg",
          title: "text-warn-fg",
          text: "text-warn-fg/80",
        };
  const showAmounts =
    notice.kind === "amount_mismatch" &&
    notice.enteredAmount != null &&
    notice.voucherAmount != null &&
    notice.currency != null;

  return (
    <div className="space-y-3">
      <div className={`rounded-card border p-4 sm:p-5 ${palette.box}`} role="alert">
        <div className="flex items-start gap-3.5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${palette.icon}`}>
            <KindIcon kind={notice.kind} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={`text-[15px] font-semibold tracking-[-0.01em] ${palette.title}`}>{notice.title}</p>
            <p className={`mt-1 text-[13px] leading-5 ${palette.text}`}>{notice.message}</p>
          </div>
        </div>

        {showAmounts ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-box bg-surface/80 px-3 py-2.5 ring-1 ring-inset ring-danger-line">
              <p className="text-[11px] font-medium text-ink-3">Monto que ingresaste</p>
              <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-ink line-through decoration-danger-fg/70">
                {formatChargeAmount(notice.enteredAmount!, notice.currency!)}
              </p>
            </div>
            <div className="rounded-box bg-surface/80 px-3 py-2.5 ring-1 ring-inset ring-danger-line">
              <p className="text-[11px] font-medium text-ink-3">Monto en tu boleta</p>
              <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-ink">
                {formatChargeAmount(notice.voucherAmount!, notice.currency!)}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5 rounded-box bg-subtle px-3.5 py-2.5 text-[12px] leading-5 text-ink-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
        <span>
          <span className="font-semibold text-ink">Soporte ya tiene tu caso.</span> Te avisaremos por aquí y por
          correo. No vuelvas a pagar.
        </span>
      </div>

      {notice.tip ? (
        <p className="px-1 text-[12px] leading-5 text-ink-2">
          <span className="font-semibold text-ink-2">Para la próxima: </span>
          {notice.tip.replace(/^Para la próxima,\s*/i, "").replace(/^./, (c) => c.toUpperCase())}
        </p>
      ) : null}
    </div>
  );
}
