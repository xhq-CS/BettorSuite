import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Crown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Leaderboard</h1>
        <p className="text-muted-foreground text-sm">Top bettors ranked by performance</p>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-0 border-b border-border">
          <CardTitle className="text-sm font-display font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Global Rankings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center pl-6">Rank</TableHead>
                <TableHead>Bettor</TableHead>
                <TableHead className="text-center">Action</TableHead>
                <TableHead className="text-center">Win Rate</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right pr-6">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12">Calculating ranks...</TableCell></TableRow>
              ) : leaderboard?.length ? (
                leaderboard.map((entry, idx) => (
                  <TableRow key={entry.userId} className="hover:bg-muted/20">
                    <TableCell className="pl-6">
                      <div className="flex justify-center items-center">
                        {idx === 0 ? <Crown className="w-5 h-5 text-amber-400" /> :
                         idx === 1 ? <Medal className="w-5 h-5 text-slate-300" /> :
                         idx === 2 ? <Medal className="w-5 h-5 text-amber-600" /> :
                         <span className="font-mono text-muted-foreground text-sm font-medium">{entry.rank}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/profile/${entry.userId}`}>
                        <div className="flex items-center gap-3 cursor-pointer group">
                          <Avatar className="w-7 h-7 border border-border">
                            <AvatarImage src={entry.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">{entry.username.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className={`font-medium text-sm group-hover:text-primary transition-colors ${idx === 0 ? 'text-amber-400' : ''}`}>
                            {entry.username}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-mono text-sm">{entry.totalBets} Bets</div>
                      <div className="text-[10px] text-muted-foreground">{entry.wins} Wins</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono font-semibold text-green-400">{(entry.winRate * 100).toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-sm ${entry.roi !== undefined && entry.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.roi !== undefined ? `${entry.roi >= 0 ? '+' : ''}${(entry.roi * 100).toFixed(1)}%` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <span className={`font-mono font-semibold ${entry.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.totalProfit >= 0 ? '+' : ''}{formatCurrency(entry.totalProfit)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No data available.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
