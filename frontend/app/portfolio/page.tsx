'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';

type TabFilter = 'all' | 'kalshi' | 'polymarket' | 'open' | 'resolved';

interface Position {
  id: number | null;
  platform: 'kalshi' | 'polymarket';
  market_id: string;
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avg_price: number;
  current_price: number | null;
  cost_basis: number;
  current_value: number | null;
  unrealized_pnl: number | null;
  realized_pnl: number;
  status: 'open' | 'resolved' | 'closed';
  resolution: 'YES' | 'NO' | null;
  source: string;
}

interface PortfolioSummary {
  total_value: number;
  total_cost: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_pnl: number;
  open_positions: number;
  resolved_positions: number;
  win_rate: number;
}

function PnlBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={`font-semibold ${positive ? 'text-green-500' : 'text-red-500'}`}>
      {positive ? '+' : ''}${value.toFixed(2)}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  sub,
  icon,
  colorClass,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  colorClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass ?? ''}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<TabFilter>('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portfolio'],
    queryFn: apiClient.getPortfolio,
    refetchInterval: 60000,
  });

  const summary: PortfolioSummary | undefined = data?.summary;
  const positions: Position[] = data?.positions ?? [];

  const filtered = positions.filter((p) => {
    if (tab === 'kalshi') return p.platform === 'kalshi';
    if (tab === 'polymarket') return p.platform === 'polymarket';
    if (tab === 'open') return p.status === 'open';
    if (tab === 'resolved') return p.status === 'resolved';
    return true;
  });

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: `All (${positions.length})` },
    { key: 'kalshi', label: `Kalshi (${positions.filter((p) => p.platform === 'kalshi').length})` },
    { key: 'polymarket', label: `Polymarket (${positions.filter((p) => p.platform === 'polymarket').length})` },
    { key: 'open', label: `Open (${positions.filter((p) => p.status === 'open').length})` },
    { key: 'resolved', label: `Resolved (${positions.filter((p) => p.status === 'resolved').length})` },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Portfolio</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Summary cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-16" /></CardContent>
              </Card>
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Value"
              value={`$${summary.total_value.toFixed(2)}`}
              sub={`Cost: $${summary.total_cost.toFixed(2)}`}
              icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
            />
            <SummaryCard
              title="Total P&L"
              value={`${summary.total_pnl >= 0 ? '+' : ''}$${summary.total_pnl.toFixed(2)}`}
              sub={`Unrealised: $${summary.unrealized_pnl.toFixed(2)}`}
              icon={
                summary.total_pnl >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )
              }
              colorClass={summary.total_pnl >= 0 ? 'text-green-500' : 'text-red-500'}
            />
            <SummaryCard
              title="Win Rate"
              value={`${summary.win_rate.toFixed(1)}%`}
              sub={`${summary.resolved_positions} resolved`}
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              colorClass={summary.win_rate >= 50 ? 'text-green-500' : 'text-red-500'}
            />
            <SummaryCard
              title="Open Positions"
              value={String(summary.open_positions)}
              sub={`${summary.resolved_positions} resolved`}
              icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        ) : null}

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {/* Positions table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : isError ? (
          <Card className="border-destructive">
            <CardContent className="py-8 text-center text-destructive">
              Failed to load portfolio. Make sure you&apos;re authenticated.
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No positions</h3>
              <p className="text-muted-foreground">
                Your {tab === 'all' ? '' : tab + ' '}positions will appear here once you start trading.
              </p>
              <Link href="/compare" className="mt-4">
                <Button variant="outline">Browse Markets</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-7 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Market</span>
              <span>Side</span>
              <span className="text-right">Avg Price</span>
              <span className="text-right">Current</span>
              <span className="text-right">P&L</span>
              <span className="text-right">Status</span>
            </div>

            {filtered.map((pos, i) => (
              <Card key={pos.id ?? i} className="hover:border-primary/30 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
                    {/* Market info */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            pos.platform === 'kalshi'
                              ? 'border-blue-400 text-blue-500'
                              : 'border-purple-400 text-purple-500'
                          }
                        >
                          {pos.platform === 'kalshi' ? 'Kalshi' : 'Poly'}
                        </Badge>
                        <span className="text-sm font-medium line-clamp-1">{pos.question}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{pos.market_id}</span>
                    </div>

                    {/* Side */}
                    <div>
                      <Badge variant={pos.side === 'YES' ? 'default' : 'secondary'} className="text-xs">
                        {pos.side}
                      </Badge>
                    </div>

                    {/* Avg price */}
                    <div className="text-right text-sm">
                      {(pos.avg_price * 100).toFixed(1)}¢
                    </div>

                    {/* Current price */}
                    <div className="text-right text-sm">
                      {pos.current_price != null
                        ? `${(pos.current_price * 100).toFixed(1)}¢`
                        : '—'}
                    </div>

                    {/* P&L */}
                    <div className="text-right text-sm">
                      {pos.status === 'open' ? (
                        <PnlBadge value={pos.unrealized_pnl} />
                      ) : (
                        <PnlBadge value={pos.realized_pnl} />
                      )}
                    </div>

                    {/* Status */}
                    <div className="text-right">
                      <Badge
                        variant={
                          pos.status === 'open'
                            ? 'default'
                            : pos.status === 'resolved'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-xs"
                      >
                        {pos.status}
                        {pos.resolution ? ` (${pos.resolution})` : ''}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
