import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Crown, Flame, Medal, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StreakStrip } from "@/components/profile/StreakStrip";
import type { StreakDay } from "@/lib/social-types";

type Entry = {
  rank: number;
  userId: number;
  username: string;
  avatarUrl?: string | null;
  totalBets: number;
  wins: number;
  winRate: number;
  roi: number;
  totalProfit: number;
  streak?: StreakDay[];
};

function PodiumCard({ entry }: { entry: Entry }) {
  const colors =
    entry.rank === 1
      ? "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-yellow-50"
      : entry.rank === 2
        ? "border-slate-300 bg-gradient-to-br from-slate-50 via-white to-slate-100/70"
        : "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50/50";
  return (
    <Link href={`/profile/${entry.userId}`}>
    <Card className={`relative cursor-pointer overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-md ${colors}`}>
      <div className="absolute right-3 top-3 font-mono text-5xl font-black text-slate-900/[0.05]">
        {entry.rank}
      </div>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <Avatar className="h-11 w-11 border border-white shadow-sm">
            <AvatarImage src={entry.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-slate-950 text-sm font-bold text-white">{entry.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {entry.rank === 1 ? (
                <Crown className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <Medal className="h-3.5 w-3.5" />
              )}{" "}
              Rank {entry.rank}
            </div>
            <div className="truncate text-lg font-bold text-slate-950">
              @{entry.username}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-y border-slate-200/80 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              Net Profit
            </div>
            <div
              className={`font-mono text-lg font-bold ${entry.totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}
            >
              {entry.totalProfit >= 0 ? "+" : ""}
              {formatCurrency(entry.totalProfit)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              ROI
            </div>
            <div className="font-mono text-lg font-bold text-slate-900">
              {entry.roi >= 0 ? "+" : ""}
              {(entry.roi * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <StreakStrip days={entry.streak} />
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}

export default function Leaderboard() {
  const board = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api<Entry[]>("/leaderboard"),
  });
  const entries = board.data ?? [];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            <Flame className="h-4 w-4" /> Community Edge
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked from highest to lowest net profit on settled tracked bets.
            The Monday-to-Sunday strip is context, not the score.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-slate-800">Weekly pulse:</span>{" "}
          green = profit · red = loss · gray = no action or break-even
        </div>
      </div>

      {entries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {entries.slice(0, 3).map((entry) => (
            <PodiumCard key={entry.userId} entry={entry} />
          ))}
        </div>
      )}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-border bg-slate-50/70 py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" /> Global Rankings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 pl-5">Rank</TableHead>
                <TableHead>Bettor</TableHead>
                <TableHead className="text-center">Week Form</TableHead>
                <TableHead className="text-right">Record</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="pr-5 text-right">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.userId}
                  className={entry.rank <= 3 ? "bg-amber-50/20" : undefined}
                >
                  <TableCell className="pl-5 font-mono text-base font-bold text-slate-500">
                    #{entry.rank}
                  </TableCell>
                  <TableCell>
                    <Link href={`/profile/${entry.userId}`}>
                      <div className="flex cursor-pointer items-center gap-2.5 hover:text-blue-600">
                        <Avatar className="h-8 w-8"><AvatarImage src={entry.avatarUrl ?? undefined} alt="" /><AvatarFallback className="bg-slate-900 text-[10px] font-bold text-white">{entry.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <span className="font-semibold">@{entry.username}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <StreakStrip days={entry.streak} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {entry.wins}W · {entry.totalBets - entry.wins}L
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(entry.winRate * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-semibold ${entry.roi >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {entry.roi >= 0 ? "+" : ""}
                    {(entry.roi * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell
                    className={`pr-5 text-right font-mono font-bold ${entry.totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {entry.totalProfit >= 0 ? "+" : ""}
                    {formatCurrency(entry.totalProfit)}
                  </TableCell>
                </TableRow>
              ))}
              {!board.isLoading && !entries.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-16 text-center text-muted-foreground"
                  >
                    No rankings yet. Settled tracked bets will appear here.
                  </TableCell>
                </TableRow>
              )}
              {board.isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-16 text-center text-muted-foreground"
                  >
                    Building the board…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
