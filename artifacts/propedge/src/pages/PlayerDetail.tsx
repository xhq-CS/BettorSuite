import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetPlayer, useGetPlayerStats, useGetPlayerPropSummary, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Activity, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from "date-fns";

export default function PlayerDetail() {
  const [, params] = useRoute("/stats/players/:id");
  const playerId = parseInt(params?.id || "0");
  const [period, setPeriod] = useState<'week'|'biweek'|'month'|'season'>('month');

  const { data: player, isLoading: playerLoading } = useGetPlayer(playerId, { 
    query: { enabled: !!playerId, queryKey: ['getPlayer', playerId] } 
  });
  
  const { data: stats, isLoading: statsLoading } = useGetPlayerStats(playerId, period, {
    query: { enabled: !!playerId, queryKey: getGetPlayerStatsQueryKey(playerId, period) }
  });

  const { data: propSummary, isLoading: summaryLoading } = useGetPlayerPropSummary(playerId, {
    query: { enabled: !!playerId, queryKey: ['getPlayerPropSummary', playerId] }
  });

  const isBasketball = player?.sport === 'NBA' || player?.sport === 'WNBA';
  const isBaseball = player?.sport === 'MLB';

  // Prepare chart data
  const chartData = stats?.map(stat => ({
    date: format(new Date(stat.gameDate), 'MMM d'),
    points: stat.points || 0,
    rebounds: stat.rebounds || 0,
    assists: stat.assists || 0,
    threes: stat.threePointers || 0,
    hits: stat.hits || 0,
    hrs: stat.homeRuns || 0,
    rbis: stat.rbis || 0,
  })).reverse() || [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-md shadow-xl">
          <p className="font-display font-medium text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs font-mono">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground uppercase">{entry.name}:</span>
              <span className="font-bold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (playerLoading) return <div className="animate-pulse space-y-6"><div className="h-32 bg-muted rounded-lg" /><div className="h-96 bg-muted rounded-lg" /></div>;
  if (!player) return <div>Player not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Link href="/stats">
        <div className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-primary transition-colors cursor-pointer mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Intel Hub
        </div>
      </Link>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1">
          <div className="flex items-end gap-4 mb-2">
            <h1 className="text-4xl font-display font-bold tracking-tighter">{player.name}</h1>
            <div className="text-2xl font-mono text-muted-foreground pb-1">#{player.number}</div>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-muted-foreground">
            <Link href={`/stats/teams/${player.teamId}`}>
              <span className="hover:text-secondary transition-colors cursor-pointer">{player.teamName}</span>
            </Link>
            <span>•</span>
            <span>{player.position}</span>
            <span>•</span>
            <Badge variant="outline">{player.sport}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryLoading ? (
          [1,2,3,4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-md" />)
        ) : (
          <>
            {isBasketball && (
              <>
                <StatCard label="PTS AVG" value={propSummary?.avgPoints} />
                <StatCard label="REB AVG" value={propSummary?.avgRebounds} />
                <StatCard label="AST AVG" value={propSummary?.avgAssists} />
                <StatCard label="3PM AVG" value={propSummary?.avgThreePointers} />
              </>
            )}
            {isBaseball && (
              <>
                <StatCard label="HIT AVG" value={propSummary?.avgHits} />
                <StatCard label="HR AVG" value={propSummary?.avgHomeRuns} />
                <StatCard label="RBI AVG" value={propSummary?.avgRbis} />
                <StatCard label="GAMES" value={propSummary?.gamesPlayed} />
              </>
            )}
          </>
        )}
      </div>

      <Card className="bg-card/50 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Performance Trends
          </CardTitle>
          <Tabs value={period} onValueChange={(v: any) => setPeriod(v)} className="w-[300px]">
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="week" className="text-[10px]">7D</TabsTrigger>
              <TabsTrigger value="biweek" className="text-[10px]">14D</TabsTrigger>
              <TabsTrigger value="month" className="text-[10px]">30D</TabsTrigger>
              <TabsTrigger value="season" className="text-[10px]">ALL</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full mt-4">
            {statsLoading ? (
              <div className="w-full h-full bg-muted/20 animate-pulse rounded flex items-center justify-center text-muted-foreground font-mono text-sm">Loading telemetry...</div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }} iconType="circle" />
                  
                  {isBasketball && (
                    <>
                      <Line type="monotone" dataKey="points" name="Points" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="rebounds" name="Rebounds" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="assists" name="Assists" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} />
                    </>
                  )}
                  {isBaseball && (
                    <>
                      <Line type="monotone" dataKey="hits" name="Hits" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} />
                      <Line type="step" dataKey="hrs" name="Home Runs" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm">No data for selected period</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-2">
            <Target className="w-4 h-4 text-secondary" />
            Game Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>OPP</TableHead>
                {isBasketball && (
                  <>
                    <TableHead className="text-right">MIN</TableHead>
                    <TableHead className="text-right">PTS</TableHead>
                    <TableHead className="text-right">REB</TableHead>
                    <TableHead className="text-right">AST</TableHead>
                    <TableHead className="text-right">3PM</TableHead>
                    <TableHead className="text-right">STL</TableHead>
                    <TableHead className="text-right">BLK</TableHead>
                  </>
                )}
                {isBaseball && (
                  <>
                    <TableHead className="text-right">H</TableHead>
                    <TableHead className="text-right">HR</TableHead>
                    <TableHead className="text-right">RBI</TableHead>
                    <TableHead className="text-right">R</TableHead>
                    <TableHead className="text-right">SO</TableHead>
                    <TableHead className="text-right">BB</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Loading log...</TableCell></TableRow>
              ) : stats?.length ? (
                stats.map((stat) => (
                  <TableRow key={stat.id}>
                    <TableCell>{format(new Date(stat.gameDate), 'MM/dd/yy')}</TableCell>
                    <TableCell>{stat.opponent}</TableCell>
                    {isBasketball && (
                      <>
                        <TableCell className="text-right">{stat.minutesPlayed}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{stat.points}</TableCell>
                        <TableCell className="text-right font-bold text-secondary">{stat.rebounds}</TableCell>
                        <TableCell className="text-right font-bold text-accent">{stat.assists}</TableCell>
                        <TableCell className="text-right">{stat.threePointers}</TableCell>
                        <TableCell className="text-right">{stat.steals}</TableCell>
                        <TableCell className="text-right">{stat.blocks}</TableCell>
                      </>
                    )}
                    {isBaseball && (
                      <>
                        <TableCell className="text-right font-bold text-primary">{stat.hits}</TableCell>
                        <TableCell className="text-right font-bold text-secondary">{stat.homeRuns}</TableCell>
                        <TableCell className="text-right font-bold text-accent">{stat.rbis}</TableCell>
                        <TableCell className="text-right">{stat.runs}</TableCell>
                        <TableCell className="text-right">{stat.strikeouts}</TableCell>
                        <TableCell className="text-right">{stat.walks}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No games in period</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string, value?: number | null }) {
  return (
    <Card className="bg-card/40 border-border">
      <CardContent className="p-4 text-center">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
        <div className="text-2xl font-mono font-bold">{value !== undefined && value !== null ? value.toFixed(1) : '-'}</div>
      </CardContent>
    </Card>
  );
}
