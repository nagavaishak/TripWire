'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import {
  ArrowRightLeft,
  BarChart3,
  BriefcaseBusiness,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { data: arbData, isLoading: arbLoading } = useQuery({
    queryKey: ['compare-arbitrage'],
    queryFn: () => apiClient.compareArbitrage(),
    staleTime: 55000,
    refetchInterval: 60000,
  });

  const arbCount: number = arbData?.opportunities?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header / Nav */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold">TripWire</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/markets">
              <Button variant="ghost" size="sm">Markets</Button>
            </Link>
            <Link href="/compare">
              <Button variant="ghost" size="sm">Compare</Button>
            </Link>
            <Link href="/portfolio">
              <Button variant="ghost" size="sm">Portfolio</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <div>
          <h2 className="text-3xl font-bold mb-2">Prediction Market Intelligence</h2>
          <p className="text-muted-foreground">
            Compare Kalshi and Polymarket side-by-side. Spot arbitrage instantly.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                Markets Tracked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">2</p>
              <p className="text-xs text-muted-foreground mt-1">Kalshi + Polymarket</p>
            </CardContent>
          </Card>

          <Link href="/compare" className="group">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                  Live Comparisons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold group-hover:text-primary transition-colors">
                  <ArrowRightLeft className="w-6 h-6 inline mr-1 -mt-1" />
                  Compare
                </p>
                <p className="text-xs text-muted-foreground mt-1">Search any event</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/portfolio" className="group">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                  Open Positions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold group-hover:text-primary transition-colors">
                  <BriefcaseBusiness className="w-6 h-6 inline mr-1 -mt-1" />
                  Portfolio
                </p>
                <p className="text-xs text-muted-foreground mt-1">Track your trades</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* CTA row */}
        <div className="flex flex-wrap gap-3">
          <Link href="/compare">
            <Button size="lg" className="gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Compare Markets
            </Button>
          </Link>
          <Link href="/portfolio">
            <Button size="lg" variant="outline" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              View Portfolio
            </Button>
          </Link>
        </div>

        {/* Arbitrage alert card */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-500" />
            Live Arbitrage
          </h3>
          {arbLoading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : (
            <Card className={arbCount > 0 ? 'border-red-400/60' : 'border-border'}>
              <CardContent className="py-5 flex items-center justify-between gap-4">
                <div>
                  {arbCount > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-red-500">{arbCount} opportunities</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Mispricing detected across Kalshi and Polymarket
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-muted-foreground">No arbitrage detected</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Markets are in consensus — check back soon
                      </p>
                    </>
                  )}
                </div>
                <Link href="/compare">
                  <Button variant={arbCount > 0 ? 'default' : 'outline'} size="sm" className="shrink-0">
                    {arbCount > 0 ? 'View Now' : 'Browse Markets'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Platform status */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Platform Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">Kalshi</p>
                  <p className="text-xs text-muted-foreground">US regulated exchange</p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-500/30 bg-green-500/10">
                  Live
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">Polymarket</p>
                  <p className="text-xs text-muted-foreground">Decentralized prediction market</p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-500/30 bg-green-500/10">
                  Live
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
