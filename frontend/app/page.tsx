'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { oracleClient, type TopicScore } from '@/lib/api';
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

const TOPICS = ['Solana', 'AI'];

function DoaGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 66 ? 'bg-green-500' : clamped >= 33 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex items-end justify-between">
        <span className="text-4xl font-bold tabular-nums">{clamped.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground mb-1">/ 100</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function SourceBar({
  label,
  value,
  weight,
  color,
}: {
  label: string;
  value: number;
  weight: number;
  color: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value * 100}%`, opacity: 0.5 + weight * 0.5 }}
        />
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: string }) {
  const { data, isLoading, isError, dataUpdatedAt } = useQuery<TopicScore>({
    queryKey: ['topic', topic],
    queryFn: () => oracleClient.getTopic(topic),
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
  });

  const age = data
    ? Math.round((Date.now() / 1000 - data.timestamp) / 60)
    : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{topic}</CardTitle>
          {data && (
            <Badge
              variant="outline"
              className={
                age != null && age <= 10
                  ? 'text-green-500 border-green-500/30 bg-green-500/10'
                  : 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'
              }
            >
              {age != null && age <= 1 ? 'Live' : `${age}m ago`}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load — oracle may be starting up</p>
        ) : data ? (
          <>
            <DoaGauge value={data.value} />

            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Source breakdown
              </p>
              <SourceBar
                label="Google Trends"
                value={data.weights.google_trends}
                weight={data.weights.google_trends}
                color="bg-blue-500"
              />
              <SourceBar
                label="Farcaster"
                value={data.weights.farcaster}
                weight={data.weights.farcaster}
                color="bg-purple-500"
              />
              <SourceBar
                label="YouTube"
                value={data.weights.youtube}
                weight={data.weights.youtube}
                color="bg-red-500"
              />
            </div>
          </>
        ) : null}

        <div className="pt-2 flex gap-2">
          <Link href={`/compare?a=${topic}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Compare
            </Button>
          </Link>
          <Link href={`/portfolio?topic=${topic}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              History
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: allData, isLoading: allLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['all-topics'],
    queryFn: () => oracleClient.getAllTopics(),
    refetchInterval: 5 * 60 * 1000,
  });

  const scores = allData?.topics ?? {};
  const topicList = Object.keys(scores);
  const highestTopic = topicList.sort(
    (a, b) => (scores[b]?.value ?? 0) - (scores[a]?.value ?? 0)
  )[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold">TripWire</span>
            <Badge variant="secondary" className="text-xs ml-1">Oracle</Badge>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/compare">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowRightLeft className="w-4 h-4" />
                Compare
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <BarChart3 className="w-4 h-4" />
                History
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <div>
          <h2 className="text-3xl font-bold mb-2">Attention Oracle</h2>
          <p className="text-muted-foreground max-w-xl">
            Real-time Degree of Attention (DoA) scores for prediction market topics.
            Aggregated from YouTube, Google Trends, and Farcaster. Updated every 5 minutes.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                Topics Tracked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{TOPICS.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{TOPICS.join(', ')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">3</p>
              <p className="text-xs text-muted-foreground mt-1">
                YouTube · Trends · Farcaster
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                Highest Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : highestTopic ? (
                <>
                  <p className="text-3xl font-bold">{highestTopic}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    DoA {scores[highestTopic]?.value.toFixed(1)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Loading…</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Topic cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Live Scores
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Auto-refreshes every 5 min
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {TOPICS.map((topic) => (
              <TopicCard key={topic} topic={topic} />
            ))}
          </div>
        </div>

        {/* Oracle status */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Oracle Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'Google Trends', weight: '35%', note: 'Search interest · no key needed' },
              { name: 'Farcaster', weight: '35%', note: 'Warpcast API · crypto-native' },
              { name: 'YouTube', weight: '30%', note: 'Data API v3 · view-weighted' },
            ].map((src) => (
              <Card key={src.name}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{src.name}</p>
                    <p className="text-xs text-muted-foreground">{src.note}</p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-500/30 bg-green-500/10 text-xs"
                    >
                      Live
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{src.weight}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
