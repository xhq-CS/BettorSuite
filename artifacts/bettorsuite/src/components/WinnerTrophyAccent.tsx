import { cn } from "@/lib/utils";

type WinnerTrophyAccentProps = {
  className?: string;
};

export function WinnerTrophyAccent({ className }: WinnerTrophyAccentProps) {
  return (
    <img
      src="/assets/winner-trophy.png"
      alt=""
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-10 select-none object-contain drop-shadow-[0_4px_7px_rgba(180,119,18,0.22)]",
        className,
      )}
    />
  );
}
