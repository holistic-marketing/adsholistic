import { cn } from "@/lib/cn";
import { PanelIcon } from "@/components/ui/PanelIcon";
import type { LaunchOptions } from "@/lib/campaigns/launch-options.server";

type Video = LaunchOptions["videos"][number];

/**
 * Portadas de la biblioteca de la cuenta para elegir videos (v3): el elegido
 * lleva borde naranja y check. La usan «Lanzar campaña» y «Agregar videos».
 */
export function VideoPickGrid({
  videos,
  picked,
  disabled,
  onToggle,
  labelledBy,
}: {
  videos: Video[];
  picked: string[];
  disabled?: boolean;
  onToggle: (videoId: string) => void;
  /** Id del rótulo que nombra al grupo. */
  labelledBy?: string;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex max-h-[15rem] flex-wrap gap-2 overflow-y-auto p-0.5">
      {videos.map((video) => {
        const on = picked.includes(video.videoId);
        return (
          <button
            key={video.videoId}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(video.videoId)}
            title={video.name}
            aria-label={video.name}
            aria-pressed={on}
            className={cn(
              "relative grid h-28 w-[4.1rem] place-items-center overflow-hidden rounded-ctl border bg-subtle text-ink-3 transition disabled:cursor-not-allowed motion-reduce:transition-none",
              on ? "border-accent ring-2 ring-accent" : "border-line opacity-70 hover:opacity-100",
            )}
          >
            {video.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <PanelIcon name="video" />
            )}
            {on ? (
              <span aria-hidden className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent-btn text-on-accent">
                <PanelIcon name="check" className="size-3" />
              </span>
            ) : null}
            {video.durationSec ? (
              <span className="num absolute bottom-1 left-1 rounded-[4px] bg-surface/90 px-1 text-[10px] font-semibold text-ink">
                {video.durationSec}s
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
