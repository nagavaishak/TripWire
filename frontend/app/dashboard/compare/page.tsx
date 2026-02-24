'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { oracleClient, type TopicScore } from '@/lib/api';
import { ArrowLeft, ArrowRightLeft, RefreshCw, Zap } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

const PRESET_TOPICS = ['Solana', 'AI', 'Bitcoin', 'Ethereum', 'DeFi'];

function SourceRow({
  label,
  aWeight,
  bWeight,
  color,
}: {
  label: string;
  aWeight: number;
  bWeight: number;
  color: string;
}) {
  const aVal = (aWeight * 100).toFixed(0);
  const bVal = (bWeight * 100).toFixed(0);
  const winner = aWeight > bWeight ? 'a' : aWeight < bWeight ? 'b' : 'tie';
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`w-20 text-right font-mono tabular-nums ${winner === 'a' ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
        {aVal}%
      </span>
      <div className="flex-1 text-center text-xs text-muted-foreground">{label}</div>
      <span className={`w-20 text-left font-mono tabular-nums ${winner === 'b' ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
        {bVal}%
      </span>
    </div>
  );
}

function ScoreDiff({ a, b }: { a: number; b: number }) {
  const diff = Math.abs(a - b);
  const leader = a > b ? 'left' : a < b ? 'right' : 'tie';
  return (
    <div className="text-center py-4 border-y">
      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Spread</p>
      <p className="text-3xl font-bold tabular-nums">{diff.toFixed(1)}</p>
      {leader !== 'tie' ? (
        <p className="text-xs text-muted-foreground mt-1">
          {leader === 'left' ? 'Left' : 'Right'} topic leads
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">Tied</p>
      )}
    </div>
  );
}

function ComparePanel({
  topicA,
  topicB,
}: {
  topicA: string;
  topicB: string;
}) {
  const { data: a, isLoading: aLoading, isError: aError } = useQuery<TopicScore>({
    queryKey: ['topic', topicA],
    queryFn: () => oracleClient.getTopic(topicA),
    refetchInterval: 5 * 60 * 1000,
    enabled: !!topicA,
  });

  const { data: b, isLoading: bLoading, isError: bError } = useQuery<TopicScore>({
    queryKey: ['topic', topicB],
    queryFn: () => oracleClient.getTopic(topicB),
    refetchInterval: 5 * 60 * 1000,
    enabled: !!topicB,
  });

  const loading = aLoading || bLoading;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Score row */}
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="text-center">
            <p className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              {topicA}
            </p>
            {aLoading ? (
              <Skeleton className="h-12 w-20 mx-auto" />
            ) : aError ? (
              <p className="text-destructive text-sm">Error</p>
            ) : a ? (
              <p className="text-5xl font-bold tabular-nums">{a.value.toFixed(1)}</p>
            ) : null}
          </div>

          <div className="text-center text-muted-foreground">
            <ArrowRightLeft className="w-6 h-6 mx-auto" />
            <p className="text-xs mt-1">DoA</p>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              {topicB}
            </p>
            {bLoading ? (
              <Skeleton className="h-12 w-20 mx-auto" />
            ) : bError ? (
              <p className="text-destructive text-sm">Error</p>
            ) : b ? (
              <p className="text-5xl font-bold tabular-nums">{b.value.toFixed(1)}</p>
            ) : null}
          </div>
        </div>

        {/* Progress bars */}
        {!loading && a && b && (
          <>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${a.value}%` }}
                />
              </div>
              <div />
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-purple-500 transition-all"
                  style={{ width: `${b.value}%` }}
                />
              </div>
            </div>

            <ScoreDiff a={a.value} b={b.value} />

            {/* Source breakdown */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">
                Source weights
              </p>
              <SourceRow
                label="Google Trends"
                aWeight={a.weights.google_trends}
                bWeight={b.weights.google_trends}
                color="bg-blue-500"
              />
              <SourceRow
                label="Farcaster"
                aWeight={a.weights.farcaster}
                bWeight={b.weights.farcaster}
                color="bg-purple-500"
              />
              <SourceRow
                label="YouTube"
                aWeight={a.weights.youtube}
                bWeight={b.weights.youtube}
                color="bg-red-500"
              />
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground text-center pt-2 border-t">
              <p>
                Updated{' '}
                {Math.round((Date.now() / 1000 - a.timestamp) / 60)}m ago
              </p>
              <p>
                Updated{' '}
                {Math.round((Date.now() / 1000 - b.timestamp) / 60)}m ago
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ComparePageInner() {
  const params = useSearchParams();
  const [topicA, setTopicA] = useState(params.get('a') || 'Solana');
  const [topicB, setTopicB] = useState(params.get('b') || 'AI');
  const [inputA, setInputA] = useState(topicA);
  const [inputB, setInputB] = useState(topicB);

  const handleCompare = () => {
    if (inputA.trim()) setTopicA(inputA.trim());
    if (inputB.trim()) setTopicB(inputB.trim());
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Compare Topics</h1>
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Auto-refreshes every 5 min
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Input row */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Topic A</p>
            <Input
              value={inputA}
              onChange={(e) => setInputA(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
              placeholder="e.g. Solana"
            />
          </div>
          <div className="pb-0.5">
            <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Topic B</p>
            <Input
              value={inputB}
              onChange={(e) => setInputB(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
              placeholder="e.g. AI"
            />
          </div>
          <Button onClick={handleCompare} className="shrink-0">
            Compare
          </Button>
        </div>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-2">
          {PRESET_TOPICS.map((t) => (
            <Button
              key={t}
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                if (!topicA || topicA === topicB) {
                  setInputA(t);
                  setTopicA(t);
                } else {
                  setInputB(t);
                  setTopicB(t);
                }
              }}
            >
              {t}
            </Button>
          ))}
        </div>

        {/* Comparison panel */}
        {topicA && topicB && <ComparePanel topicA={topicA} topicB={topicB} />}

        {/* Links to history */}
        {topicA && topicB && (
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/dashboard/portfolio?topic=${topicA}`}>
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                {topicA} History
              </Button>
            </Link>
            <Link href={`/dashboard/portfolio?topic=${topicB}`}>
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                {topicB} History
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <ComparePageInner />
    </Suspense>
  );
}
