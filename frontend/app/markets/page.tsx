'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRightLeft, Search, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MarketsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedKalshi, setSelectedKalshi] = useState<any | null>(null);
  const [selectedPoly, setSelectedPoly] = useState<any | null>(null);
  const [showArbitrageOnly, setShowArbitrageOnly] = useState(false);

  // Search results
  const {
    data: searchResults,
    isFetching: isSearching,
    isError: searchError,
  } = useQuery({
    queryKey: ['markets-search', submittedQuery],
    queryFn: () => apiClient.searchMarkets(submittedQuery),
    enabled: submittedQuery.length > 0,
  });

  // Comparison data (only runs when both markets are selected)
  const {
    data: comparison,
    isFetching: isComparing,
    isError: compareError,
  } = useQuery({
    queryKey: ['markets-compare', selectedKalshi?.ticker, selectedPoly?.conditionId],
    queryFn: () =>
      apiClient.compareMarkets(selectedKalshi.ticker, selectedPoly.conditionId),
    enabled: !!(selectedKalshi && selectedPoly),
  });

  // Arbitrage opportunities
  const { data: arbitrageData, isFetching: isLoadingArbitrage } = useQuery({
    queryKey: ['markets-arbitrage'],
    queryFn: () => apiClient.getArbitrageOpportunities(),
    enabled: showArbitrageOnly,
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSubmittedQuery(searchQuery.trim());
      setSelectedKalshi(null);
      setSelectedPoly(null);
    }
  };

  const kalshiResults: any[] = searchResults?.results?.kalshi ?? [];
  const polyResults: any[] = searchResults?.results?.polymarket ?? [];

  const canCompare = selectedKalshi && selectedPoly;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Cross-Platform Markets</h1>
          <Button
            variant={showArbitrageOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowArbitrageOnly((v) => !v)}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {showArbitrageOnly ? 'Hide Arbitrage' : 'Show Arbitrage'}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        {/* Arbitrage Opportunities Panel */}
        {showArbitrageOnly && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Arbitrage Opportunities (&gt;5% spread)</h2>
            {isLoadingArbitrage ? (
              <div className="grid grid-cols-1 gap-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : arbitrageData?.opportunities?.length ? (
              <div className="grid grid-cols-1 gap-3">
                {arbitrageData.opportunities.map((opp: any, i: number) => (
                  <Card key={i} className="border-orange-300">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{opp.event}</span>
                        <Badge variant="destructive">{opp.spread_pct.toFixed(1)}% spread</Badge>
                      </div>
                      <div className="flex gap-6 mt-2 text-sm text-muted-foreground">
                        <span>
                          Kalshi:{' '}
                          <strong>{((opp.kalshi?.probability ?? 0) * 100).toFixed(1)}%</strong>
                        </span>
                        <span>
                          Polymarket:{' '}
                          <strong>
                            {((opp.polymarket?.probability ?? 0) * 100).toFixed(1)}%
                          </strong>
                        </span>
                        <span>
                          Best:{' '}
                          <Badge variant="secondary" className="capitalize">
                            {opp.best_platform}
                          </Badge>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No arbitrage opportunities found (threshold: 5%)
                </CardContent>
              </Card>
            )}
            <Separator className="mt-6" />
          </section>
        )}

        {/* Search Bar */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Search Kalshi and Polymarket</h2>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., recession, Fed rate, Bitcoin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              <Search className="w-4 h-4 mr-2" />
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </section>

        {/* Search Results — two columns */}
        {submittedQuery && (
          <section>
            <p className="text-sm text-muted-foreground mb-4">
              Results for &ldquo;<strong>{submittedQuery}</strong>&rdquo;. Select one from each
              column to compare.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kalshi Column */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="secondary">Kalshi</Badge>
                  <span className="text-sm text-muted-foreground">
                    ({kalshiResults.length} results)
                  </span>
                </h3>
                {isSearching ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : kalshiResults.length === 0 ? (
                  <Card>
                    <CardContent className="pt-4 text-sm text-muted-foreground">
                      No Kalshi markets found
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {kalshiResults.map((market: any) => (
                      <button
                        key={market.ticker}
                        type="button"
                        onClick={() =>
                          setSelectedKalshi(
                            selectedKalshi?.ticker === market.ticker ? null : market,
                          )
                        }
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selectedKalshi?.ticker === market.ticker
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/40'
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {market.title ?? market.event_title ?? market.ticker}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ID: {market.ticker}
                          {market.volume != null && ` · Vol: ${market.volume.toLocaleString()}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Polymarket Column */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">Polymarket</Badge>
                  <span className="text-sm text-muted-foreground">
                    ({polyResults.length} results)
                  </span>
                </h3>
                {isSearching ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : polyResults.length === 0 ? (
                  <Card>
                    <CardContent className="pt-4 text-sm text-muted-foreground">
                      No Polymarket markets found
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {polyResults.map((market: any) => (
                      <button
                        key={market.conditionId}
                        type="button"
                        onClick={() =>
                          setSelectedPoly(
                            selectedPoly?.conditionId === market.conditionId ? null : market,
                          )
                        }
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selectedPoly?.conditionId === market.conditionId
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/40'
                        }`}
                      >
                        <div className="font-medium text-sm">{market.question}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ID: {market.conditionId.slice(0, 16)}...
                          {market.volume != null &&
                            ` · Vol: ${market.volume.toLocaleString()}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Compare Button */}
        {canCompare && (
          <div className="flex justify-center">
            <div className="flex items-center gap-4 bg-muted/50 rounded-lg p-4 max-w-xl w-full">
              <div className="text-sm flex-1 text-center">
                <div className="text-muted-foreground text-xs mb-1">Kalshi</div>
                <div className="font-medium">{selectedKalshi.ticker}</div>
              </div>
              <ArrowRightLeft className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="text-sm flex-1 text-center">
                <div className="text-muted-foreground text-xs mb-1">Polymarket</div>
                <div className="font-medium">
                  {selectedPoly.conditionId.slice(0, 16)}...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Card */}
        {canCompare && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Comparison</h2>
            {isComparing ? (
              <Skeleton className="h-48 w-full" />
            ) : compareError ? (
              <Card>
                <CardContent className="pt-6 text-center text-destructive">
                  Failed to load comparison. Check that both market IDs are valid.
                </CardContent>
              </Card>
            ) : comparison ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{comparison.event}</CardTitle>
                    {comparison.arbitrage_opportunity ? (
                      <Badge variant="destructive">Arbitrage Opportunity</Badge>
                    ) : (
                      <Badge variant="secondary">No Arbitrage</Badge>
                    )}
                  </div>
                  <CardDescription>
                    Consensus probability:{' '}
                    <strong>
                      {(comparison.consensus_probability * 100).toFixed(1)}%
                    </strong>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <Badge variant="secondary">Kalshi</Badge>
                      </div>
                      <div className="text-3xl font-bold">
                        {comparison.kalshi
                          ? `${(comparison.kalshi.probability * 100).toFixed(1)}%`
                          : '—'}
                      </div>
                      {comparison.kalshi && (
                        <div className="text-xs text-muted-foreground">
                          Vol: {comparison.kalshi.volume.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <Badge variant="outline">Polymarket</Badge>
                      </div>
                      <div className="text-3xl font-bold">
                        {comparison.polymarket
                          ? `${(comparison.polymarket.probability * 100).toFixed(1)}%`
                          : '—'}
                      </div>
                      {comparison.polymarket && (
                        <div className="text-xs text-muted-foreground">
                          24h Vol: {comparison.polymarket.volume24h.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Spread: <strong>{comparison.spread_pct.toFixed(2)}%</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Best platform:{' '}
                      <Badge variant="secondary" className="capitalize">
                        {comparison.best_platform}
                      </Badge>
                    </span>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <Button
                      className="flex-1"
                      onClick={() =>
                        router.push(
                          `/markets/${encodeURIComponent(selectedKalshi.ticker)}/trade?platform=kalshi`,
                        )
                      }
                    >
                      Set Rule on Kalshi
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        router.push(
                          `/markets/${encodeURIComponent(selectedPoly.conditionId)}/trade?platform=polymarket`,
                        )
                      }
                    >
                      Set Rule on Polymarket
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
