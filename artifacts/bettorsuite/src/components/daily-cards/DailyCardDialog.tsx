import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Layers3, Send, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SelectableBet {
  id: number;
  description: string;
  sport: string | null;
  betType: string;
  status: string;
  createdAt: string;
}
interface ExistingCard { id: number; title: string; picks: unknown[]; cardDate: string }

interface DailyCardDialogProps {
  destination: "war-room" | "group" | "dm";
  groupId?: number;
  conversationId?: number;
  onClose: () => void;
  onPosted?: () => void;
}

export function DailyCardDialog({
  destination,
  groupId,
  conversationId,
  onClose,
  onPosted,
}: DailyCardDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Today's Card");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const bets = useQuery({
    queryKey: ["daily-card-bets"],
    queryFn: () => api<SelectableBet[]>("/bets"),
  });
  const existingCards = useQuery({
    queryKey: ["daily-cards", "mine"],
    queryFn: () => api<ExistingCard[]>("/daily-cards/mine"),
  });
  const repost = useMutation({
    mutationFn: (cardId: number) => api(`/daily-cards/${cardId}/share`, {
      method: "POST",
      body: JSON.stringify({ destination, groupId, conversationId }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["war-room"] });
      queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      toast.success("Daily card reposted");
      onPosted?.();
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to repost card"),
  });
  const sortedBets = useMemo(
    () =>
      [...(bets.data ?? [])].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [bets.data],
  );

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const create = useMutation({
    mutationFn: () =>
      api("/daily-cards", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          note: note.trim() || undefined,
          betIds: [...selected],
          destination,
          groupId,
          conversationId,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["war-room"] });
      queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["profile-daily-cards"] });
      toast.success("Daily card posted");
      onPosted?.();
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to post card"),
  });

  const toggle = (betId: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(betId)) next.delete(betId);
      else if (next.size < 12) next.add(betId);
      return next;
    });
  };
  const invalidTitle = submitted && !title.trim();
  const invalidPicks = submitted && selected.size < 2;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-card-title"
        className="max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
          <div>
            <h2 id="daily-card-title" className="flex items-center gap-2 text-lg font-bold">
              <Layers3 className="h-5 w-5 text-blue-400" /> Build a Daily Card
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Package 2–12 Book Keeper picks with clear league labels.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close daily card builder"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-300 hover:bg-white/10 hover:text-red-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid max-h-[calc(94vh-76px)] overflow-y-auto md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
          <div className="space-y-4 border-b border-slate-200 p-5 md:border-b-0 md:border-r">
            {(existingCards.data?.length ?? 0) > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Repost an existing card</p>
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {existingCards.data?.slice(0, 8).map((card) => <button type="button" key={card.id} onClick={() => repost.mutate(card.id)} className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-xs hover:bg-blue-50">
                  <span className="truncate font-semibold">{card.title}</span><span className="ml-2 shrink-0 font-mono text-[9px] text-slate-500">{card.picks.length} picks · Repost</span>
                </button>)}
              </div>
            </div>}
            <div>
              <label htmlFor="daily-card-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Card Name *
              </label>
              <Input
                id="daily-card-name"
                value={title}
                maxLength={80}
                aria-invalid={invalidTitle}
                onChange={(event) => setTitle(event.target.value)}
                className={invalidTitle ? "border-red-400 ring-2 ring-red-100" : ""}
              />
              {invalidTitle && <p className="mt-1 text-xs text-red-600">Give this card a name.</p>}
            </div>
            <div>
              <label htmlFor="daily-card-note" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Capper's Note
              </label>
              <Textarea
                id="daily-card-note"
                value={note}
                maxLength={600}
                rows={5}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Your read, confidence, or package notes…"
                className="resize-y"
              />
              <div className="mt-1 text-right text-[10px] text-slate-400">{note.length}/600</div>
            </div>
            <div className={`rounded-xl border p-4 ${invalidPicks ? "border-red-300 bg-red-50" : "border-blue-200 bg-blue-50"}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Card Progress</div>
              <div className="mt-1 flex items-end justify-between">
                <div className="font-mono text-3xl font-black text-slate-950">{selected.size}<span className="text-base text-slate-400">/12</span></div>
                <div className={`text-xs font-semibold ${selected.size >= 2 ? "text-emerald-700" : "text-slate-500"}`}>
                  {selected.size >= 2 ? "Ready to post" : `${2 - selected.size} more required`}
                </div>
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={create.isPending}
              onClick={() => {
                setSubmitted(true);
                if (title.trim() && selected.size >= 2) create.mutate();
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              {create.isPending ? "Posting…" : "Post Daily Card"}
            </Button>
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Choose Book Keeper Picks</div>
                <p className="mt-1 text-xs text-slate-500">Pending picks appear first. Settled picks can be packaged as a recap.</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-600">2 minimum</span>
            </div>
            <div className={`max-h-[32rem] space-y-2 overflow-y-auto pr-1 ${invalidPicks ? "rounded-xl ring-2 ring-red-100" : ""}`}>
              {sortedBets.map((bet) => {
                const checked = selected.has(bet.id);
                return (
                  <button
                    key={bet.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggle(bet.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${checked ? "border-blue-500 bg-blue-50 ring-1 ring-blue-100" : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${checked ? "border-blue-500 bg-blue-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        {bet.sport || "Other"} · {bet.betType}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900">{bet.description}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase ${bet.status === "pending" ? "bg-blue-50 text-blue-600" : bet.status === "won" ? "bg-emerald-50 text-emerald-600" : bet.status === "lost" ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"}`}>
                      {bet.status === "pending" ? "Pending" : bet.status}
                    </span>
                  </button>
                );
              })}
              {!bets.isLoading && !sortedBets.length && (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  Add picks in Book Keeper before building a daily card.
                </div>
              )}
              {bets.isLoading && <div className="py-10 text-center text-sm text-slate-500">Loading your picks…</div>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
