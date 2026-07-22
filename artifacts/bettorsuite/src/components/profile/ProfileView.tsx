import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  Check,
  Layers3,
  MessageCircleMore,
  Pencil,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { StreakStrip } from "@/components/profile/StreakStrip";
import { PublicPickCard } from "@/components/profile/PublicPickCard";
import { DailyCardCard } from "@/components/daily-cards/DailyCardCard";
import { DailyCardDialog } from "@/components/daily-cards/DailyCardDialog";
import { TailBetDialog } from "@/components/shared-bets/TailBetDialog";
import type { SharedBetSnapshot } from "@/components/shared-bets/SharedBetCard";
import type { BettorProfile, DailyCard, PublicPick } from "@/lib/social-types";

interface ProfileViewProps {
  userId?: number;
  isOwn?: boolean;
}

export function ProfileView({ userId, isOwn = false }: ProfileViewProps) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"picks" | "cards">("picks");
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [favoriteSport, setFavoriteSport] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [tailBet, setTailBet] = useState<SharedBetSnapshot | null>(null);
  const [showDailyCard, setShowDailyCard] = useState(false);
  const profilePath = isOwn ? "/users/me" : `/users/${userId}`;
  const profile = useQuery({
    queryKey: ["profile", isOwn ? "me" : userId],
    queryFn: () => api<BettorProfile>(profilePath),
    enabled: isOwn || Boolean(userId),
  });
  const resolvedId = profile.data?.id;
  const picks = useQuery({
    queryKey: ["profile-picks", resolvedId],
    queryFn: () => api<PublicPick[]>(`/users/${resolvedId}/picks`),
    enabled: Boolean(resolvedId),
  });
  const cards = useQuery({
    queryKey: ["profile-daily-cards", resolvedId],
    queryFn: () => api<DailyCard[]>(`/users/${resolvedId}/daily-cards`),
    enabled: Boolean(resolvedId),
  });
  const sports = useMemo(
    () =>
      [...new Set((picks.data ?? []).map((pick) => pick.snapshot.sport || "Other"))].sort(),
    [picks.data],
  );
  const filteredPicks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (picks.data ?? []).filter((pick) => {
      if (sport !== "all" && (pick.snapshot.sport || "Other") !== sport) return false;
      if (status !== "all" && pick.snapshot.status !== status) return false;
      return !query || pick.snapshot.description.toLowerCase().includes(query);
    });
  }, [picks.data, search, sport, status]);

  const save = useMutation({
    mutationFn: () =>
      api<BettorProfile>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName, bio, favoriteSport, avatarUrl: avatarUrl ?? "" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["war-room"] });
      setEditing(false);
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update profile"),
  });
  const follow = useMutation({
    mutationFn: () =>
      api(`/users/${resolvedId}/follow`, {
        method: profile.data?.isFollowing ? "DELETE" : "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["community-search"] });
    },
  });
  const message = useMutation({
    mutationFn: () =>
      api<{ id: number }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ participantId: resolvedId }),
      }),
    onSuccess: (conversation) => navigate(`/messages?conversation=${conversation.id}`),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to start message"),
  });
  const deleteCard = useMutation({
    mutationFn: (cardId: number) =>
      api(`/daily-cards/${cardId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-daily-cards", resolvedId] });
      queryClient.invalidateQueries({ queryKey: ["war-room"] });
      toast.success("Daily card removed");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to remove card"),
  });

  if (profile.isLoading) return <div className="py-20 text-center text-sm text-muted-foreground">Loading profile…</div>;
  if (!profile.data) return <div className="py-20 text-center text-sm text-muted-foreground">Profile not found.</div>;
  const person = profile.data;
  const stats = person.stats;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="h-28 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900" />
        <CardContent className="px-5 pb-6 sm:px-8">
          <div className="-mt-14 grid gap-5 sm:grid-cols-[128px_minmax(0,1fr)]">
            <div className="flex justify-center sm:justify-start">
              {editing ? (
                <AvatarUploader username={person.username} value={avatarUrl} onChange={setAvatarUrl} />
              ) : (
                <Avatar className="h-28 w-28 border-4 border-white shadow-lg ring-1 ring-slate-200">
                  <AvatarImage src={person.avatarUrl ?? undefined} alt={`${person.username} profile`} />
                  <AvatarFallback className="bg-slate-950 text-2xl font-bold text-white">{person.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="pt-0 sm:pt-16">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-950">{person.displayName || person.username}</h1>
                  <p className="text-sm text-slate-500">@{person.username}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isOwn ? (
                    <Button
                      type="button"
                      variant={editing ? "ghost" : "outline"}
                      onClick={() => {
                        if (editing) return setEditing(false);
                        setDisplayName(person.displayName || "");
                        setBio(person.bio || "");
                        setFavoriteSport(person.favoriteSport || "");
                        setAvatarUrl(person.avatarUrl);
                        setEditing(true);
                      }}
                    >
                      {editing ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                      {editing ? "Cancel" : "Edit Profile"}
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant={person.isFollowing ? "secondary" : "default"} disabled={follow.isPending} onClick={() => follow.mutate()}>
                        {person.isFollowing ? <Check className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        {person.isFollowing ? "Following" : "Follow"}
                      </Button>
                      <Button type="button" variant="outline" disabled={message.isPending} onClick={() => message.mutate()}>
                        <MessageCircleMore className="mr-2 h-4 w-4" /> Message
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="profile-name" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Display Name</label><Input id="profile-name" value={displayName} maxLength={50} onChange={(event) => setDisplayName(event.target.value)} /></div>
                  <div><label htmlFor="profile-sport" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Favorite League</label><Input id="profile-sport" value={favoriteSport} maxLength={40} onChange={(event) => setFavoriteSport(event.target.value)} placeholder="NBA, NFL, MLB…" /></div>
                  <div className="sm:col-span-2"><label htmlFor="profile-bio" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Bio</label><Textarea id="profile-bio" value={bio} maxLength={240} rows={3} onChange={(event) => setBio(event.target.value)} placeholder="Tell bettors about your edge…" /><div className="mt-1 text-right text-[10px] text-slate-400">{bio.length}/240</div></div>
                  <Button type="button" className="sm:col-span-2" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save Profile"}</Button>
                </div>
              ) : (
                <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                      <span><strong className="font-mono text-slate-950">{(picks.data?.length ?? 0) + (cards.data?.length ?? 0)}</strong> posts</span>
                      <span><strong className="font-mono text-slate-950">{person.followersCount}</strong> followers</span>
                      <span><strong className="font-mono text-slate-950">{person.followingCount}</strong> following</span>
                    </div>
                    <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-700">{person.bio || "No bio yet."}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {person.favoriteSport && <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{person.favoriteSport}</span>}
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Joined {new Date(person.createdAt).toLocaleDateString([], { month: "long", year: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-3 lg:border-l lg:border-slate-200 lg:pl-6">
                    <span className="mb-1.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">7-Day Form</span>
                    <StreakStrip days={stats.streak} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Profit</div><div className={`mt-1 font-mono text-2xl font-black ${stats.totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{stats.totalProfit >= 0 ? "+" : ""}{formatCurrency(stats.totalProfit)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Win Rate</div><div className="mt-1 font-mono text-2xl font-black text-slate-950">{(stats.winRate * 100).toFixed(1)}%</div><div className="mt-1 text-xs text-slate-500">{stats.wins}W · {stats.losses}L · {stats.pushes}P</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ROI</div><div className={`mt-1 font-mono text-2xl font-black ${stats.roi >= 0 ? "text-emerald-600" : "text-red-600"}`}>{stats.roi >= 0 ? "+" : ""}{(stats.roi * 100).toFixed(1)}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tracked Picks</div><div className="mt-1 flex items-center gap-2 font-mono text-2xl font-black text-slate-950"><BarChart3 className="h-5 w-5 text-blue-600" />{stats.totalBets}</div></CardContent></Card>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-4 pt-4 sm:flex-row sm:items-end">
          <div className="flex gap-5">
            <button type="button" onClick={() => setTab("picks")} className={`border-b-2 pb-3 text-sm font-bold ${tab === "picks" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>Public Picks</button>
            <button type="button" onClick={() => setTab("cards")} className={`border-b-2 pb-3 text-sm font-bold ${tab === "cards" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>Daily Cards</button>
          </div>
          {tab === "picks" ? (
            <div className="flex flex-wrap gap-2 pb-3">
              <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search picks…" className="h-9 w-44 pl-8 text-xs" /></div>
              <Select value={sport} onValueChange={setSport}><SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All leagues</SelectItem>{sports.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
              <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All results</SelectItem><SelectItem value="pending">Open</SelectItem><SelectItem value="won">Won</SelectItem><SelectItem value="lost">Lost</SelectItem><SelectItem value="push">Push</SelectItem></SelectContent></Select>
            </div>
          ) : isOwn ? (
            <Button type="button" size="sm" variant="outline" className="mb-3" onClick={() => setShowDailyCard(true)}>
              <Layers3 className="mr-1.5 h-4 w-4 text-blue-600" /> Post Daily Card
            </Button>
          ) : null}
        </div>
        <CardContent className="p-4">
          {tab === "picks" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredPicks.map((pick) => <PublicPickCard key={pick.id} pick={pick} onTail={setTailBet} />)}
              {!picks.isLoading && !filteredPicks.length && <div className="col-span-full py-16 text-center text-sm text-slate-500">No public picks match these filters.</div>}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {(cards.data ?? []).map((card) => <DailyCardCard key={card.id} card={card} onTail={setTailBet} onDelete={isOwn ? (item) => deleteCard.mutate(item.id) : undefined} />)}
              {!cards.isLoading && !cards.data?.length && <div className="col-span-full py-16 text-center text-sm text-slate-500">No daily cards posted yet.</div>}
            </div>
          )}
        </CardContent>
      </Card>
      <TailBetDialog bet={tailBet} onClose={() => setTailBet(null)} />
      {showDailyCard && (
        <DailyCardDialog
          destination="war-room"
          onClose={() => setShowDailyCard(false)}
        />
      )}
    </div>
  );
}
