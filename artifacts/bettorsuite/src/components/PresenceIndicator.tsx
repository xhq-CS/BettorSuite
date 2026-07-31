import { cn } from "@/lib/utils";

export type PresenceStatus = "online" | "idle" | "offline";

const presenceMeta: Record<PresenceStatus, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-emerald-500" },
  idle: { label: "Idle", dot: "bg-amber-400" },
  offline: { label: "Offline", dot: "bg-slate-400" },
};

type PresenceIndicatorProps = {
  status?: PresenceStatus | null;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "lg";
};

export function PresenceIndicator({
  status = "offline",
  className,
  showLabel = false,
  size = "sm",
}: PresenceIndicatorProps) {
  const resolved = status ?? "offline";
  const meta = presenceMeta[resolved];

  return (
    <span
      className={cn(
        showLabel
          ? "inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"
          : cn(
              "absolute z-10 grid place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200",
              size === "lg"
                ? "-bottom-1 -right-1 h-5 w-5"
                : "-bottom-0.5 -right-0.5 h-3.5 w-3.5",
            ),
        className,
      )}
      title={meta.label}
      aria-label={meta.label}
    >
      <span
        className={cn(
          "block rounded-full",
          showLabel
            ? "h-2 w-2"
            : size === "lg"
              ? "h-3.5 w-3.5"
              : "h-2.5 w-2.5",
          meta.dot,
          resolved === "offline" && "ring-1 ring-inset ring-slate-500/30",
        )}
      />
      {showLabel ? meta.label : null}
    </span>
  );
}
