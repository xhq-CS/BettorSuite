import { useGetTrendingProps, useGetLeaderboard, useListBets, useGetSimulatorWallet } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Trophy, Wallet, Receipt } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";

export default function Dashboard() {
  const { data: trendingProps, isLoading: trendingLoading } = useGetTrendingProps();
  const { data: leaderboard, isLoading: leaderboardLoading } = useGetLeaderboard();
  const { data: bets, isLoading: betsLoading } = useListBets({ status: "pending" });
  const { data: wallet, isLoading: walletLoading } = useGetSimulatorWallet();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your betting overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Simulator Wallet */}
        <Card className="bg-card border-border relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Sim Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded" />
            ) : (
              <div>
                <div className="text-3xl font-mono text-foreground font-bold">
                  {formatCurrency(wallet?.balance || 0)}
                </div>
                <div className="mt-1.5 text-xs font-mono">
                  <span className={wallet?.totalProfit && wallet.totalProfit >= 0 ? "text-green-400" : "text-red-400"}>
                    {wallet?.totalProfit && wallet.totalProfit >= 0 ? "+" : ""}{formatCurrency(wallet?.totalProfit || 0)}
                  </span>
                  <span className="text-muted-foreground ml-2">All Time P&L</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Bets */}
        <Card className="md:col-span-2 bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              Pending Action
            </CardTitle>
            <Link href="/tracker">
              <span className="text-xs text-primary hover:underline cursor-pointer">View All</span>
            </Link>
          </CardHeader>
          <CardContent>
            {betsLoading ? (
              <div className="space-y-2">
                <div className="h-12 bg-muted animate-pulse rounded" />
                <div className="h-12 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <div className="space-y-2">
                {bets?.slice(0, 3).map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
                    <div>
                      <div className="font-medium text-sm">{bet.description}</div>
                      <div className="text-xs font-mono text-muted-foreground mt-0.5">
                        {bet.wager ? formatCurrency(bet.wager) : "$0.00"} @ {bet.odds > 0 ? `+${bet.odds}` : bet.odds}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-green-400">{formatCurrency(bet.potentialPayout || 0)}</div>
                      <div className="text-[10px] text-muted-foreground uppercase mt-0.5">To Win</div>
                    </div>
                  </div>
                ))}
                {(!bets || bets.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground text-sm">No pending bets.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trending Props */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Trending Props
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendingLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {trendingProps?.map((prop, idx) => (
                  <Link key={`${prop.playerId}-${idx}`} href={`/stats/players/${prop.playerId}`}>
                    <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border hover:border-primary/40 hover:bg-muted/40 transition-colors cursor-pointer group">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm group-hover:text-primary transition-colors">{prop.playerName}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {prop.sport}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{prop.teamName} · {prop.statType}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-mono">{prop.recentAvg} avg</div>
                          <div className="text-[10px] text-muted-foreground uppercase">Last 5</div>
                        </div>
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full ${
                          prop.trend === 'up' ? 'bg-green-500/10 text-green-400' :
                          prop.trend === 'down' ? 'bg-red-500/10 text-red-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {prop.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                          {prop.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                          {prop.trend === 'flat' && <Minus className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leaderboard Snippet */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Sharpest Bettors
            </CardTitle>
            <Link href="/leaderboard">
              <span className="text-xs text-primary hover:underline cursor-pointer">View All</span>
            </Link>
          </CardHeader>
          <CardContent>
            {leaderboardLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard?.slice(0, 5).map((entry) => (
                  <Link key={entry.userId} href={`/profile/${entry.userId}`}>
                    <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border hover:bg-muted/40 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 flex items-center justify-center bg-muted rounded text-[10px] font-mono font-bold text-muted-foreground">
                          {entry.rank}
                        </div>
                        <span className="font-medium text-sm group-hover:text-primary transition-colors">{entry.username}</span>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="text-sm font-mono text-green-400">{(entry.winRate * 100).toFixed(1)}%</div>
                          <div className="text-[10px] text-muted-foreground uppercase">Win Rate</div>
                        </div>
                        <div className="w-20">
                          <div className="text-sm font-mono">{formatCurrency(entry.totalProfit)}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">Profit</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
