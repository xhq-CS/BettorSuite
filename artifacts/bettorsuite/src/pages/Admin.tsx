import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Search, UserRound, ReceiptText, RotateCcw, Trash2, Save, History } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AdminUser = {
  id: number; username: string; email: string | null; displayName: string | null;
  avatarUrl: string | null; role: string; trackerBankroll: number; warRoomMuted: boolean; createdAt: string;
};
type AdminBet = {
  id: number; description: string; sport: string | null; status: string;
  odds: string | number; wager: number; potentialPayout: number; betDate: string;
};
type UserDetail = { user: AdminUser & { bio?: string | null; favoriteSport?: string | null }; bets: AdminBet[] };
type Overview = { users: number; bets: number; pendingBets: number; recent: Array<{ id: number; action: string; reason: string; targetUserId: number; createdAt: string }> };

export default function AdminHome() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [summary, list] = await Promise.all([
      api<Overview>("/admin/overview"),
      api<AdminUser[]>(`/admin/users?search=${encodeURIComponent(search)}`),
    ]);
    setOverview(summary);
    setUsers(list);
  };
  useEffect(() => { void refresh().catch((error) => toast.error(error.message)); }, [search]);
  useEffect(() => {
    if (!selectedId) return setDetail(null);
    void api<UserDetail>(`/admin/users/${selectedId}`).then(setDetail).catch((error) => toast.error(error.message));
  }, [selectedId]);

  const selected = useMemo(() => users.find((item) => item.id === selectedId), [users, selectedId]);
  if (user?.role !== "admin") return <div className="p-8 text-sm text-muted-foreground">Administrator access required.</div>;

  const run = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await task();
      toast.success(success);
      setReason(""); setConfirmation("");
      await refresh();
      if (selectedId) setDetail(await api<UserDetail>(`/admin/users/${selectedId}`));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Action failed"); }
    finally { setBusy(false); }
  };

  const saveProfile = () => {
    if (!detail) return;
    return run(() => api(`/admin/users/${detail.user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...detail.user, reason }),
    }), "Account changes saved");
  };

  return <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
    <div className="flex items-center justify-between">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><h1 className="font-display text-2xl font-bold">Control Room</h1></div><p className="mt-1 text-sm text-muted-foreground">Search accounts, inspect betting records, and perform audited moderation.</p></div>
      <Badge variant="outline">Admin · @{user.username}</Badge>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Signed-up users", overview?.users ?? 0], ["Tracked bets", overview?.bets ?? 0], ["Pending bets", overview?.pendingBets ?? 0]].map(([label, value]) =>
        <Card key={String(label)}><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-mono text-2xl font-bold">{value}</p></CardContent></Card>)}
    </div>
    <div className="grid min-h-[620px] gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b p-4"><CardTitle className="text-base">Accounts</CardTitle><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Username, email, or name" value={search} onChange={(event) => setSearch(event.target.value)} /></div></CardHeader>
        <CardContent className="max-h-[650px] space-y-1 overflow-y-auto p-2">
          {users.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${selectedId === item.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-muted">{item.avatarUrl ? <img src={item.avatarUrl} className="h-full w-full object-cover" alt="" /> : <UserRound className="h-4 w-4" />}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">@{item.username}</p><p className="truncate text-xs text-muted-foreground">{item.email}</p></div>
            {item.role === "admin" && <Badge className="text-[9px]">ADMIN</Badge>}
          </button>)}
        </CardContent>
      </Card>
      {!detail ? <Card className="grid place-items-center"><div className="text-center text-muted-foreground"><UserRound className="mx-auto mb-3 h-8 w-8" /><p>Select an account to moderate it.</p></div></Card> :
      <div className="space-y-4">
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Account profile</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
          <div><Label>Username</Label><Input value={detail.user.username} onChange={(e) => setDetail({ ...detail, user: { ...detail.user, username: e.target.value } })} /></div>
          <div><Label>Email</Label><Input value={detail.user.email ?? ""} onChange={(e) => setDetail({ ...detail, user: { ...detail.user, email: e.target.value } })} /></div>
          <div><Label>Display name</Label><Input value={detail.user.displayName ?? ""} onChange={(e) => setDetail({ ...detail, user: { ...detail.user, displayName: e.target.value } })} /></div>
          <div><Label>Favorite sport</Label><Input value={detail.user.favoriteSport ?? ""} onChange={(e) => setDetail({ ...detail, user: { ...detail.user, favoriteSport: e.target.value } })} /></div>
          <div className="md:col-span-2"><Label>Bio</Label><Textarea value={detail.user.bio ?? ""} onChange={(e) => setDetail({ ...detail, user: { ...detail.user, bio: e.target.value } })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={detail.user.warRoomMuted} onChange={(e) => setDetail({ ...detail, user: { ...detail.user, warRoomMuted: e.target.checked } })} />Mute in Public War Room</label>
          <div><Label>Moderation reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required for changes" /></div>
          <div className="md:col-span-2 flex justify-end"><Button disabled={busy || reason.length < 3} onClick={saveProfile}><Save className="mr-2 h-4 w-4" />Save audited changes</Button></div>
        </CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4" />Book Keeper history</CardTitle></CardHeader><CardContent className="space-y-2">
          {detail.bets.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">No tracked bets.</p> : detail.bets.map((bet) =>
            <div key={bet.id} className="grid items-center gap-2 rounded-lg border p-3 md:grid-cols-[1fr_90px_90px_130px_auto]">
              <div><p className="text-sm font-semibold">{bet.description}</p><p className="text-xs text-muted-foreground">{bet.sport ?? "Other"} · {new Date(bet.betDate).toLocaleDateString()}</p></div>
              <p className="font-mono text-xs">${bet.wager.toFixed(2)}</p><p className="font-mono text-xs">{Number(bet.odds) > 0 ? "+" : ""}{bet.odds}</p>
              <Select value={bet.status} onValueChange={(status) => run(() => api(`/admin/users/${detail.user.id}/bets/${bet.id}`, { method: "PATCH", body: JSON.stringify({ status, reason }) }), "Bet result corrected")}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["pending", "won", "lost", "push", "void"].map((status) => <SelectItem key={status} value={status}>{status.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="icon" variant="outline" disabled={busy || reason.length < 3} onClick={() => run(() => api(`/admin/users/${detail.user.id}/bets/${bet.id}`, { method: "DELETE", body: JSON.stringify({ reason }) }), "Bet deleted and wallet reversed")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>)}
        </CardContent></Card>
        {detail.user.role !== "admin" && <Card className="border-red-200"><CardHeader className="pb-3"><CardTitle className="text-base text-red-700">Danger zone</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Type @{detail.user.username} to confirm</Label><Input value={confirmation} onChange={(e) => setConfirmation(e.target.value.replace(/^@/, ""))} /></div>
          <Button variant="outline" className="border-amber-300" disabled={busy || confirmation !== detail.user.username || reason.length < 3} onClick={() => run(() => api(`/admin/users/${detail.user.id}/reset`, { method: "POST", body: JSON.stringify({ confirmation, reason }) }), "Account data reset; login and profile preserved")}><RotateCcw className="mr-2 h-4 w-4" />Reset account data</Button>
          <Button variant="destructive" disabled={busy || confirmation !== detail.user.username || reason.length < 3} onClick={() => run(async () => { await api(`/admin/users/${detail.user.id}`, { method: "DELETE", body: JSON.stringify({ confirmation, reason }) }); setSelectedId(null); }, "Account permanently deleted")}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>
        </CardContent></Card>}
      </div>}
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Recent audit trail</CardTitle></CardHeader><CardContent className="space-y-2">{overview?.recent.map((log) => <div key={log.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-xs"><span><b>{log.action}</b> · User #{log.targetUserId}</span><span className="text-muted-foreground">{log.reason} · {new Date(log.createdAt).toLocaleString()}</span></div>)}</CardContent></Card>
  </main>;
}
