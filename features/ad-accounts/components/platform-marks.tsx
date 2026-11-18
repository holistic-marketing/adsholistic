/** Logos de plataforma (sin estado; sirven en server y client components). */

export function TikTokMark() {
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold tracking-wide"
    >
      <span className="text-[#25f4ee]">T</span>
      <span className="text-[#fe2c55]">T</span>
    </span>
  );
}

export function MetaMark({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0668E1] to-[#0081FB]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.68} height={size * 0.68} fill="none">
        <path
          d="M4.2 15.6c0 1.4.7 2.3 1.8 2.3 1 0 1.7-.6 3.4-3.4l1.4-2.3.2-.4.2.3 1.3 2.2c1.6 2.6 2.6 3.6 4.1 3.6 1.7 0 2.9-1.6 2.9-4.2 0-3.3-1.9-6.6-4.3-6.6-1.4 0-2.5 1-3.5 2.4l-.6.9-.6-.9C9.4 8.1 8.3 7.1 6.9 7.1 4.6 7.1 4.2 11 4.2 15.6Z"
          stroke="white"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
