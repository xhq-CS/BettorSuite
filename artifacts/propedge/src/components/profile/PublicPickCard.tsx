import { History, PencilLine } from "lucide-react";
import { SharedBetCard, type SharedBetSnapshot } from "@/components/shared-bets/SharedBetCard";
import type { PublicPick } from "@/lib/social-types";

interface PublicPickCardProps {
  pick: PublicPick;
  onTail: (bet: SharedBetSnapshot) => void;
}

export function PublicPickCard({ pick, onTail }: PublicPickCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          {pick.edited ? (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-700"><PencilLine className="h-3 w-3" /> Edited</span>
          ) : (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-700">Tracked Pick</span>
          )}
          <span className="text-[10px] text-slate-400">
            {new Date(pick.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
        {pick.revisions.length > 0 && (
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-blue-600">
              <History className="h-3.5 w-3.5" /> {pick.revisions.length} prior {pick.revisions.length === 1 ? "version" : "versions"}
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-72 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              {pick.revisions.map((revision) => (
                <div key={revision.id} className="rounded-lg bg-slate-50 p-2.5">
                  <div className="truncate text-xs font-semibold text-slate-800">{revision.snapshot.description}</div>
                  <div className="mt-1 text-[9px] text-slate-500">Changed {new Date(revision.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
      <SharedBetCard
        bet={pick.snapshot}
        compact
        onTail={pick.snapshot.status === "pending" ? onTail : undefined}
      />
    </article>
  );
}
