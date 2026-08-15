import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

type WinnerTrophyAccentProps = {
  className?: string;
};

export function WinnerTrophyAccent({ className }: WinnerTrophyAccentProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-20 select-none",
        className,
      )}
    >
      <div className="relative h-full w-full">
        <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_35%_28%,#fff7ce_0%,#fcd34d_38%,#d99116_76%,#9a5b08_100%)] shadow-[0_8px_24px_rgba(180,119,18,0.32)] ring-2 ring-white" />
        <div className="absolute inset-[17%] rounded-full border border-amber-200/80 bg-white/55 shadow-inner" />
        <Trophy
          strokeWidth={1.8}
          className="absolute left-1/2 top-1/2 h-[46%] w-[46%] -translate-x-1/2 -translate-y-[53%] fill-amber-300 text-amber-900"
        />
        <div className="absolute -bottom-[2%] left-1/2 -translate-x-1/2 rounded-full border border-amber-300 bg-slate-950 px-[16%] py-[3%] font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-amber-200 shadow-md">
          Winner
        </div>
      </div>
    </div>
  );
}
