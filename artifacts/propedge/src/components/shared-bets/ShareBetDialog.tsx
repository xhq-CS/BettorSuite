import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Share2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SharedBetCard,
  type SharedBetSnapshot,
} from "@/components/shared-bets/SharedBetCard";

export interface ShareableBet {
  id: number;
  description: string;
  betType: string;
  sportsbook?: string | null;
  wager: number;
  odds: number;
  parlayLegs?: SharedBetSnapshot["parlayLegs"] | null;
  profitBoostPercent?: number | null;
  potentialPayout?: number | null;
  actualPayout?: number | null;
  status: string;
  sport?: string | null;
  createdAt: string | Date;
}

type Group = { id: number; name: string; isMember: boolean };

export function ShareBetDialog({
  bet,
  source,
  onClose,
}: {
  bet: ShareableBet | null;
  source: "tracker" | "mock";
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [destination, setDestination] = useState<"war-room" | "group">(
    "war-room",
  );
  const [groupId, setGroupId] = useState("");
  const [note, setNote] = useState("");
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Group[]>("/groups"),
    enabled: Boolean(bet),
  });
  const joinedGroups = useMemo(
    () => (groups.data ?? []).filter((group) => group.isMember),
    [groups.data],
  );

  useEffect(() => {
    if (!bet) return;
    setDestination("war-room");
    setGroupId("");
    setNote(
      bet.status === "pending"
        ? "Tail or fade?"
        : bet.status === "won"
          ? "Cashed this one."
          : "",
    );
  }, [bet?.id, bet?.status]);

  useEffect(() => {
    if (!bet) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [bet, onClose]);

  const share = useMutation({
    mutationFn: () =>
      api("/shares/bet", {
        method: "POST",
        body: JSON.stringify({
          source,
          betId: bet!.id,
          destination,
          groupId: destination === "group" ? Number(groupId) : undefined,
          note: note.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["war-room"] });
      if (groupId)
        queryClient.invalidateQueries({
          queryKey: ["group-messages", Number(groupId)],
        });
      toast.success(
        destination === "war-room"
          ? "Bet shared to the War Room"
          : "Bet shared to your group",
      );
      onClose();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Unable to share bet",
      ),
  });

  if (!bet) return null;
  const preview: SharedBetSnapshot = {
    source,
    originalBetId: bet.id,
    description: bet.description,
    betType: bet.betType,
    sportsbook: bet.sportsbook ?? null,
    wager: Number(bet.wager),
    odds: Number(bet.odds),
    parlayLegs: bet.parlayLegs ?? [],
    profitBoostPercent: Number(bet.profitBoostPercent ?? 0),
    potentialPayout: Number(bet.potentialPayout ?? 0),
    actualPayout: bet.actualPayout == null ? null : Number(bet.actualPayout),
    status: bet.status,
    sport: bet.sport ?? null,
    placedAt: new Date(bet.createdAt).toISOString(),
    sharedAt: new Date().toISOString(),
  };
  const groupRequired = destination === "group" && !groupId;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <Share2 className="h-5 w-5 text-blue-600" /> Share Bet Slip
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Post the full ticket so bettors can react, review, or tail it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share bet"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Destination
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDestination("war-room")}
                  className={`rounded-xl border p-3 text-left transition-colors ${destination === "war-room" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                  <div className="mt-2 text-sm font-bold text-slate-900">
                    War Room
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Share with everyone
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDestination("group")}
                  className={`rounded-xl border p-3 text-left transition-colors ${destination === "group" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <Users className="h-4 w-4 text-blue-600" />
                  <div className="mt-2 text-sm font-bold text-slate-900">
                    Group
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Send to your crew
                  </div>
                </button>
              </div>
            </div>

            {destination === "group" && (
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Choose Group *
                </label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger
                    aria-invalid={groupRequired}
                    className={
                      groupRequired ? "border-red-400 ring-2 ring-red-100" : ""
                    }
                  >
                    <SelectValue placeholder="Select one of your groups" />
                  </SelectTrigger>
                  <SelectContent>
                    {joinedGroups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!groups.isLoading && joinedGroups.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    Join or create a group before sharing there.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Add a note
              </label>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Why do you like this bet?"
                className="resize-y"
              />
              <div className="mt-1 text-right text-[10px] text-slate-400">
                {note.length}/500
              </div>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={
                share.isPending ||
                groupRequired ||
                (destination === "group" && joinedGroups.length === 0)
              }
              onClick={() => share.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              {share.isPending
                ? "Sharing…"
                : destination === "war-room"
                  ? "Share to War Room"
                  : "Share to Group"}
            </Button>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Post Preview
            </div>
            <SharedBetCard bet={preview} />
          </div>
        </div>
      </div>
    </div>
  );
}
