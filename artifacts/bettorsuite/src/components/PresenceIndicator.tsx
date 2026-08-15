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
  size?: "xs" | "sm" | "md" | "lg" | "xl";
};

const indicatorSize = {
  xs: {
    shell: "-bottom-px -right-px h-2.5 w-2.5 ring-1",
    dot: "h-1.5 w-1.5",
  },
  sm: {
    shell: "bottom-0 right-0 h-3 w-3 ring-[1.5px]",
    dot: "h-2 w-2",
  },
  md: {
    shell: "-bottom-0.5 -right-0.5 h-3.5 w-3.5 ring-2",
    dot: "h-2.5 w-2.5",
  },
  lg: {
    shell: "-bottom-0.5 -right-0.5 h-4 w-4 ring-2",
    dot: "h-3 w-3",
  },
  xl: {
    shell: "bottom-1 right-1 h-6 w-6 ring-[3px]",
    dot: "h-[18px] w-[18px]",
  },
} as const;

export function PresenceIndicator({
  status = "offline",
  className,
  size = "md",
}: PresenceIndicatorProps) {
  const resolved = status ?? "offline";
  const meta = presenceMeta[resolved];
  const sizing = indicatorSize[size];

  return (
    <span
      className={cn(
        "absolute z-10 grid place-items-center rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.22)] ring-white",
        sizing.shell,
        className,
      )}
      title={meta.label}
      aria-label={meta.label}
    >
      <span
        className={cn(
          "block rounded-full",
          sizing.dot,
          meta.dot,
          resolved === "offline" && "ring-1 ring-inset ring-slate-500/30",
        )}
      />
    </span>
  );
}
