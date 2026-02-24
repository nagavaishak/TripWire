'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { oracleClient, type HistoryPoint } from '@/lib/api';
import { ArrowLeft, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

const TOPICS = ['Solana', 'AI'];
const HOUR_OPTIONS = [6, 24, 48];

function Sparkline({ data, height = 60 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1);
  const w = 600;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const last = data[data.length - 1];
  const first = data[0];
  const rising = last >= first;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={rising ? '#22c55e' : '#ef4444'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last point dot */}
      <circle
        cx={(((data.length - 1) / (data.length - 1)) * w).toString()}
        cy={(height - ((last - min) / range) * (height - 8) - 4).toString()}
        r="3"
        fill={rising ? '#22c55e' : '#ef4444'}
      />
    </svg>
  );
}

function HistoryPanel({ topic, hours }: { topic: string; hours: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['history', topic, hours],
    queryFn: () => oracleClient.getHistory(topic, hours),
    refetchInterval: 5 * 60 * 1000,
  });

  const points: HistoryPoint[] = data?.data ?? [];
  const values = points.map((p) => p.value);
  const latest = values[values.length - 1] ?? null;
  const earliest = values[0] ?? null;
  const delta = latest != null && earliest != null ? latest - earliest : null;
  const rising = delta != null && delta >= 0;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground mb-1">Current DoA</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : latest != null ? (
              <p className="text-2xl font-bold tabular-nums">{latest.toFixed(1)}</p>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground mb-1">{hours}h Change</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : delta != null ? (
              <p
                className={`text-2xl font-bold tabular-nums flex items-center gap-1 ${rising ? 'text-green-500' : 'text-red-500'}`}
              >
                {rising ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {rising ? '+' : ''}
                {delta.toFixed(1)}
              </p>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground mb-1">Data Points</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">{points.length}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sparkline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
            DoA Score — last {hours}h
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : isError ? (
            <p className="text-sm text-destructive py-4 text-center">
              Failed to load history
            </p>
          ) : values.length < 2 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Not enough data yet — check back after a few update cycles
            </p>
          ) : (
            <Sparkline data={values} height={80} />
          )}
        </CardContent>
      </Card>

      {/* Source breakdown table */}
      {!isLoading && points.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
              Recent readings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2">Time</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">DoA</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Trends</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Farcaster</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">YouTube</th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().slice(0, 10).map((p, i) => {
                    const date = new Date(p.time * 1000);
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">
                          {p.value.toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums text-xs">
                          {(p.components.google_trends * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums text-xs">
                          {(p.components.farcaster * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums text-xs">
                          {(p.components.youtube * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HistoryPageInner() {
  const params = useSearchParams();
  const [topic, setTopic] = useState(params.get('topic') || 'Solana');
  const [hours, setHours] = useState(24);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold">History</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Topic selector */}
          <div className="flex gap-2">
            {TOPICS.map((t) => (
              <Button
                key={t}
                variant={topic === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTopic(t)}
              >
                {t}
              </Button>
            ))}
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Hour selector */}
          <div className="flex gap-2">
            {HOUR_OPTIONS.map((h) => (
              <Button
                key={h}
                variant={hours === h ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHours(h)}
              >
                {h}h
              </Button>
            ))}
          </div>
        </div>

        <HistoryPanel topic={topic} hours={hours} />
      </main>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryPageInner />
    </Suspense>
  );
}
