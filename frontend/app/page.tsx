'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { MOCK_MODE } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const key = localStorage.getItem('tripwire_api_key');
    setApiKey(key);
  }, []);

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: apiClient.getRules,
    enabled: MOCK_MODE || !!apiKey,
  });

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: apiClient.getWallets,
    enabled: MOCK_MODE || !!apiKey,
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: apiClient.getMetrics,
    refetchInterval: MOCK_MODE ? false : 30000,
  });

  if (!MOCK_MODE && !apiKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to TripWire</CardTitle>
            <CardDescription>
              Automate your DeFi portfolio based on real-world events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              size="lg"
              onClick={() => router.push('/auth/login')}
            >
              Sign In
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/auth/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeRules = rules?.filter((r: any) => r.status === 'ACTIVE') || [];
  const totalExecutions = metrics?.executions?.total || 0;
  const successRate = metrics?.executions?.successRate || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">TripWire</h1>
          </div>
          <nav className="flex items-center space-x-4">
            <Link href="/wallets">
              <Button variant="ghost" size="sm">
                <Wallet className="w-4 h-4 mr-2" />
                Wallets
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm">Settings</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{activeRules.length}</div>
                  <p className="text-xs text-muted-foreground">{rules?.length || 0} total</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Executions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalExecutions}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">{metrics?.executions?.succeeded || 0} succeeded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wallets</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {walletsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{wallets?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Automation wallets</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Active Rules</h2>
            <Link href="/rules/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Rule
              </Button>
            </Link>
          </div>

          {rulesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : rules && rules.length > 0 ? (
            <div className="grid gap-4">
              {rules.map((rule: any) => (
                <Card key={rule.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{rule.name}</CardTitle>
                        <CardDescription className="mt-1">Market: {rule.kalshi_market_id}</CardDescription>
                      </div>
                      <Badge variant={rule.status === 'ACTIVE' ? 'default' : rule.status === 'TRIGGERED' ? 'secondary' : 'destructive'}>
                        {rule.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Trigger</p>
                        <p className="font-medium">
                          {rule.condition_type === 'THRESHOLD_ABOVE' ? '>' : '<'} {(rule.threshold_probability * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Action</p>
                        <p className="font-medium">{rule.trigger_type === 'SWAP_TO_STABLECOIN' ? 'Swap to USDC' : 'Swap to SOL'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium">{rule.swap_percentage}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cooldown</p>
                        <p className="font-medium">{rule.cooldown_hours}h</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No rules yet</h3>
                <p className="text-muted-foreground mb-4">Create your first automation rule to get started</p>
                <Link href="/rules/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Rule
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No recent executions</h3>
              <p className="text-muted-foreground">Activity will appear here when rules trigger</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
