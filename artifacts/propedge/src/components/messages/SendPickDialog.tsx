import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, TicketCheck, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatOdds } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessagePick {
  id: number;
  description: string;
  sport: string | null;
  betType: string;
  odds: number;
  status: string;
  createdAt: string;
}

interface SendPickDialogProps {
  conversationId: number;
  onClose: () => void;
}

export function SendPickDialog({ conversationId, onClose }: SendPickDialogProps) {
  const queryClient = useQueryClient();
  const [betId, setBetId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const bets = useQuery({
    queryKey: ["dm-share-picks"],
    queryFn: () => api<MessagePick[]>("/bets"),
  });
  const ordered = useMemo(
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

  const send = useMutation({
    mutationFn: () =>
      api("/shares/bet", {
        method: "POST",
        body: JSON.stringify({
          source: "tracker",
          betId,
          destination: "dm",
          conversationId,
          note: note.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Pick sent");
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to send pick"),
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="send-pick-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="send-pick-title" className="flex items-center gap-2 text-lg font-bold"><TicketCheck className="h-5 w-5 text-blue-600" /> Send a Pick</h2>
            <p className="mt-1 text-xs text-slate-500">Share a complete Tracker slip they can tail.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close pick selector" className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-4 p-5">
          <div className={`max-h-80 space-y-2 overflow-y-auto pr-1 ${submitted && !betId ? "rounded-xl ring-2 ring-red-100" : ""}`}>
            {ordered.map((bet) => (
              <button
                key={bet.id}
                type="button"
                aria-pressed={betId === bet.id}
                onClick={() => setBetId(bet.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left ${betId === bet.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-100" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <span className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{bet.sport || "Other"} · {bet.betType}</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900">{bet.description}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-bold">{formatOdds(bet.odds)}</span>
                  <span className={`block text-[9px] font-bold uppercase ${bet.status === "pending" ? "text-blue-600" : bet.status === "won" ? "text-emerald-600" : "text-slate-500"}`}>{bet.status}</span>
                </span>
              </button>
            ))}
          </div>
          {submitted && !betId && <p className="text-xs text-red-600">Choose a pick to send.</p>}
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Add a note (optional)…" className="resize-y" />
          <Button type="button" className="w-full" disabled={send.isPending} onClick={() => { setSubmitted(true); if (betId) send.mutate(); }}>
            <Send className="mr-2 h-4 w-4" /> {send.isPending ? "Sending…" : "Send Pick"}
          </Button>
        </div>
      </section>
    </div>
  );
}
