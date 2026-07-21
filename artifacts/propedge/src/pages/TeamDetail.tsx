import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetTeam, useGetTeamStats, getGetTeamStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Activity, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from "date-fns";

export default function TeamDetail() {
  const [, params] = useRoute("/stats/teams/:id");
  const teamId = parseInt(params?.id || "0");
  const [period, setPeriod] = useState<'week'|'biweek'|'month'|'season'>('month');

  const { data: team, isLoading: teamLoading } = useGetTeam(teamId, { 
    query: { enabled: !!teamId, queryKey: ['getTeam', teamId] } 
  });
  
  const { data: stats, isLoading: statsLoading } = useGetTeamStats(teamId, period, {
    query: { enabled: !!teamId, queryKey: getGetTeamStatsQueryKey(teamId, period) }
  });

  const isBasketball = team?.sport === 'NBA' || team?.sport === 'WNBA';
  const isBaseball = team?.sport === 'MLB';

  // Prepare chart data
  const chartData = stats?.map(stat => ({
    date: format(new Date(stat.gameDate), 'MMM d'),
    score: stat.score || 0,
    oppScore: stat.opponentScore || 0,
    points: stat.totalPoints || 0,
    hits: stat.totalHits || 0,
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

  if (teamLoading) return <div className="animate-pulse space-y-6"><div className="h-32 bg-muted rounded-lg" /><div className="h-96 bg-muted rounded-lg" /></div>;
  if (!team) return <div>Team not found</div>;

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
            <h1 className="text-4xl font-display font-bold tracking-tighter">{team.city} {team.name}</h1>
            <div className="text-2xl font-mono text-muted-foreground pb-1">{team.abbreviation}</div>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-muted-foreground">
            <Badge variant="outline">{team.sport}</Badge>
          </div>
        </div>
      </div>

      <Card className="bg-card/50 border-secondary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-secondary" />
            Scoring Trends
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
                  
                  <Line type="monotone" dataKey="score" name="Team Score" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="oppScore" name="Opponent Score" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
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
            <Target className="w-4 h-4 text-primary" />
            Game Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>H/A</TableHead>
                <TableHead>OPP</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Score</TableHead>
                {isBasketball && (
                  <>
                    <TableHead className="text-right">REB</TableHead>
                    <TableHead className="text-right">AST</TableHead>
                    <TableHead className="text-right">3PM</TableHead>
                  </>
                )}
                {isBaseball && (
                  <>
                    <TableHead className="text-right">H</TableHead>
                    <TableHead className="text-right">HR</TableHead>
                    <TableHead className="text-right">ERR</TableHead>
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
                    <TableCell>{stat.isHome ? 'vs' : '@'}</TableCell>
                    <TableCell>{stat.opponent}</TableCell>
                    <TableCell>
                      {stat.won === true ? <span className="text-green-400 font-bold">W</span> : 
                       stat.won === false ? <span className="text-destructive font-bold">L</span> : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold">{stat.score}-{stat.opponentScore}</TableCell>
                    
                    {isBasketball && (
                      <>
                        <TableCell className="text-right">{stat.totalRebounds}</TableCell>
                        <TableCell className="text-right">{stat.totalAssists}</TableCell>
                        <TableCell className="text-right">{stat.threePointersMade}</TableCell>
                      </>
                    )}
                    {isBaseball && (
                      <>
                        <TableCell className="text-right">{stat.totalHits}</TableCell>
                        <TableCell className="text-right">{stat.totalHomeRuns}</TableCell>
                        <TableCell className="text-right">{stat.errors}</TableCell>
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
