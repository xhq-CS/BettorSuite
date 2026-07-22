interface ProfitBoostBadgeProps {
  percent?: number | null;
}

export function ProfitBoostBadge({ percent }: ProfitBoostBadgeProps) {
  if (!percent || percent <= 0) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900" title={`${percent}% profit boost`}>
      <img src="/promotions/profit-boost.png" alt="" className="h-3.5 w-3.5 object-contain" />
      {percent}% Boost
    </span>
  );
}
