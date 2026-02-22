'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  ArrowRightLeft,
  RefreshCw,
  Search,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface ComparisonResult {
  event: string;
  kalshi: { probability: number; volume: number; market_id: string } | null;
  polymarket: { probability: number; volume24h: number; market_id: string } | null;
  spread_pct: number;
  best_platform: 'kalshi' | 'polymarket';
  arbitrage_opportunity: boolean;
  consensus_probability: number;
  timestamp: string;
}

function ProbBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

function ComparisonCard({ item, onTrade }: { item: ComparisonResult; onTrade?: (item: ComparisonResult, platform: string) => void }) {
  const kProb = item.kalshi?.probability ?? null;
  const pProb = item.polymarket?.probability ?? null;
  const showArb = item.arbitrage_opportunity;
  const bestIsPoly = item.best_platform === 'polymarket';

  return (
    <Card className={`transition-all hover:shadow-md ${showArb ? 'border-red-400/60' : 'border-border'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
            {item.event}
          </CardTitle>
          <div className="flex flex-col gap-1 shrink-0">
            {showArb && (
              <Badge className="bg-red-500 text-white text-xs px-2 py-0.5">
                ARBITRAGE {item.spread_pct.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Consensus: {(item.consensus_probability * 100).toFixed(1)}%
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Kalshi side */}
          <div className={`rounded-lg p-3 border ${!bestIsPoly && item.kalshi ? 'border-green-500/50 bg-green-500/5' : 'border-border bg-muted/30'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Kalshi</span>
              {!bestIsPoly && item.kalshi && (
                <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">BEST</Badge>
              )}
            </div>
            {item.kalshi ? (
              <>
                <p className="text-xl font-bold">{(kProb! * 100).toFixed(1)}%</p>
                <ProbBar value={kProb!} color="bg-blue-500" />
                <p className="text-xs text-muted-foreground mt-1">
                  Vol: ${(item.kalshi.volume / 1000).toFixed(0)}k
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No market</p>
            )}
          </div>

          {/* Polymarket side */}
          <div className={`rounded-lg p-3 border ${bestIsPoly && item.polymarket ? 'border-green-500/50 bg-green-500/5' : 'border-border bg-muted/30'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Polymarket</span>
              {bestIsPoly && item.polymarket && (
                <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">BEST</Badge>
              )}
            </div>
            {item.polymarket ? (
              <>
                <p className="text-xl font-bold">{(pProb! * 100).toFixed(1)}%</p>
                <ProbBar value={pProb!} color="bg-purple-500" />
                <p className="text-xs text-muted-foreground mt-1">
                  Vol24h: ${(item.polymarket.volume24h / 1000).toFixed(0)}k
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No market</p>
            )}
          </div>
        </div>

        {/* Trade buttons */}
        {(item.kalshi || item.polymarket) && onTrade && (
          <div className="flex gap-2">
            {item.kalshi && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => onTrade(item, 'kalshi')}
              >
                Trade Kalshi
              </Button>
            )}
            {item.polymarket && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => onTrade(item, 'polymarket')}
              >
                Trade Poly
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComparePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filterArb, setFilterArb] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (submittedQuery) {
        setLastRefresh(new Date());
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [submittedQuery]);

  const {
    data: searchData,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['compare-search', submittedQuery, lastRefresh],
    queryFn: () => apiClient.compareSearch(submittedQuery),
    enabled: submittedQuery.length > 0,
    staleTime: 55000,
  });

  const {
    data: arbData,
    isFetching: arbFetching,
  } = useQuery({
    queryKey: ['compare-arbitrage'],
    queryFn: () => apiClient.compareArbitrage(),
    staleTime: 55000,
  });

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      setSubmittedQuery(searchQuery.trim());
    }
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleTrade = (item: ComparisonResult, platform: string) => {
    const marketId =
      platform === 'kalshi' ? item.kalshi?.market_id : item.polymarket?.market_id;
    alert(`Trade on ${platform.toUpperCase()}: ${marketId}\n(Trade execution in stub mode)`);
  };

  const comparisons: ComparisonResult[] = searchData?.comparisons ?? [];
  const arbOpportunities: ComparisonResult[] = arbData?.opportunities ?? [];

  const displayed = submittedQuery
    ? filterArb
      ? comparisons.filter((c) => c.arbitrage_opportunity)
      : comparisons
    : arbOpportunities;

  const arbCount = comparisons.filter((c) => c.arbitrage_opportunity).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
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
                <ArrowRightLeft className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Compare Markets</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3" />
            Auto-refreshes every 60s
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Search bar */}
        <div className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search markets (e.g. Federal Reserve, Bitcoin, election...)"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
            Search
          </Button>
          {submittedQuery && (
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Filter bar */}
        {comparisons.length > 0 && (
          <div className="flex items-center gap-3">
            <Button
              variant={!filterArb ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterArb(false)}
            >
              All ({comparisons.length})
            </Button>
            <Button
              variant={filterArb ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterArb(true)}
              className={arbCount > 0 ? 'border-red-400' : ''}
            >
              Arbitrage ({arbCount})
            </Button>
          </div>
        )}

        {/* Loading */}
        {(isFetching || arbFetching) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-20 rounded-lg" />
                    <Skeleton className="h-20 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <Card className="border-destructive">
            <CardContent className="py-8 text-center text-destructive">
              Failed to load comparison data. Check your connection and try again.
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!isFetching && !isError && displayed.length > 0 && (
          <>
            {!submittedQuery && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold">Arbitrage Opportunities</h2>
                <Badge className="bg-red-500 text-white">{arbOpportunities.length}</Badge>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayed.map((item, i) => (
                <ComparisonCard key={i} item={item} onTrade={handleTrade} />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!isFetching && !isError && submittedQuery && comparisons.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No markets found</h3>
              <p className="text-muted-foreground">
                Try a different search term like "Federal Reserve", "Bitcoin", or "election"
              </p>
            </CardContent>
          </Card>
        )}

        {/* No search yet */}
        {!submittedQuery && !arbFetching && arbOpportunities.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Zap className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Compare prediction markets</h3>
              <p className="text-muted-foreground max-w-md">
                Search for any event to see side-by-side prices from Kalshi and Polymarket.
                Arbitrage opportunities are highlighted automatically.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
