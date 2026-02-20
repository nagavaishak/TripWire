'use client';

import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface TradePageProps {
  params: Promise<{ id: string }>;
}

export default function TradePage({ params }: TradePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const platform = (searchParams.get('platform') ?? 'kalshi') as 'kalshi' | 'polymarket';
  const marketId = decodeURIComponent(id);

  const [formData, setFormData] = useState({
    name: '',
    condition_type: 'THRESHOLD_ABOVE' as 'THRESHOLD_ABOVE' | 'THRESHOLD_BELOW',
    threshold_probability: 65,
    trigger_type: 'SWAP_TO_STABLECOIN' as 'SWAP_TO_STABLECOIN' | 'SWAP_TO_SOL',
    automation_wallet_id: 0,
    swap_percentage: 80,
    cooldown_hours: 24,
  });

  const updateField = (field: string, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: apiClient.getWallets,
  });

  // Pre-select first wallet when wallets load
  const firstWalletId = wallets?.[0]?.id ?? 0;
  if (firstWalletId && formData.automation_wallet_id === 0) {
    updateField('automation_wallet_id', firstWalletId);
  }

  const createRuleMutation = useMutation({
    mutationFn: (data: any) => apiClient.createRule(data),
    onSuccess: () => {
      toast.success('Rule created! Monitoring will begin shortly.');
      router.push('/');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create rule');
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }
    if (!formData.automation_wallet_id) {
      toast.error('Please select an automation wallet');
      return;
    }

    const ruleData: any = {
      name: formData.name,
      condition_type: formData.condition_type,
      threshold_probability: formData.threshold_probability / 100,
      trigger_type: formData.trigger_type,
      automation_wallet_id: formData.automation_wallet_id,
      swap_percentage: formData.swap_percentage,
      cooldown_hours: formData.cooldown_hours,
      platform,
    };

    if (platform === 'kalshi') {
      ruleData.kalshi_market_id = marketId;
    } else {
      // Polymarket: store condition_id in kalshi_market_id field for now
      // (migration 013 adds platform column; the market_id is platform-specific)
      ruleData.kalshi_market_id = marketId;
    }

    createRuleMutation.mutate(ruleData);
  };

  const isPending = createRuleMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/markets">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Markets
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Set Automation Rule</h1>
            <Badge
              variant={platform === 'kalshi' ? 'secondary' : 'outline'}
              className="capitalize"
            >
              {platform}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Market: <strong>{marketId}</strong>
          </p>
          {platform === 'polymarket' && (
            <div className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Phase 1 — Stub Mode:</strong> Polymarket trade execution on Polygon is
              deferred to Phase 2. Creating this rule will log the intent but will not place
              a real order. The rule will still monitor probability and record when it would
              have triggered.
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Rule Name */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rule Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Recession Hedge via Polymarket"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Condition */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trigger Condition</CardTitle>
              <CardDescription>When should this rule fire?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => updateField('condition_type', 'THRESHOLD_ABOVE')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.condition_type === 'THRESHOLD_ABOVE'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <div>
                      <div className="font-medium">Probability goes above threshold</div>
                      <div className="text-sm text-muted-foreground">
                        Trigger when probability rises above your set threshold
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateField('condition_type', 'THRESHOLD_BELOW')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.condition_type === 'THRESHOLD_BELOW'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <div>
                      <div className="font-medium">Probability goes below threshold</div>
                      <div className="text-sm text-muted-foreground">
                        Trigger when probability falls below your set threshold
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <div>
                <Label htmlFor="threshold">Threshold Probability (%)</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Input
                    id="threshold"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.threshold_probability}
                    onChange={(e) =>
                      updateField('threshold_probability', parseInt(e.target.value) || 0)
                    }
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-primary">
                    {formData.threshold_probability}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Action</CardTitle>
              <CardDescription>What Solana swap should execute when triggered?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => updateField('trigger_type', 'SWAP_TO_STABLECOIN')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.trigger_type === 'SWAP_TO_STABLECOIN'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="font-medium">Swap to Stablecoin (USDC)</div>
                  <div className="text-sm text-muted-foreground">
                    Convert SOL to USDC for stability
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateField('trigger_type', 'SWAP_TO_SOL')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.trigger_type === 'SWAP_TO_SOL'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="font-medium">Swap to SOL</div>
                  <div className="text-sm text-muted-foreground">
                    Convert USDC to SOL for growth exposure
                  </div>
                </button>
              </div>

              <div>
                <Label htmlFor="percentage">Swap Percentage (%)</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Input
                    id="percentage"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.swap_percentage}
                    onChange={(e) =>
                      updateField('swap_percentage', parseInt(e.target.value) || 0)
                    }
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-primary">
                    {formData.swap_percentage}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Percentage of wallet balance to swap
                </p>
              </div>

              <div>
                <Label htmlFor="wallet">Automation Wallet</Label>
                <select
                  id="wallet"
                  value={formData.automation_wallet_id}
                  onChange={(e) =>
                    updateField('automation_wallet_id', parseInt(e.target.value))
                  }
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={0} disabled>
                    Select a wallet
                  </option>
                  {wallets?.map((wallet: any) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} ({wallet.public_key.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="cooldown">Cooldown Period (hours)</Label>
                <Input
                  id="cooldown"
                  type="number"
                  min="1"
                  value={formData.cooldown_hours}
                  onChange={(e) =>
                    updateField('cooldown_hours', parseInt(e.target.value) || 24)
                  }
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum time between rule executions
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Review */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{formData.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform:</span>
                  <Badge
                    variant={platform === 'kalshi' ? 'secondary' : 'outline'}
                    className="capitalize"
                  >
                    {platform}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market:</span>
                  <span className="font-medium font-mono text-xs">{marketId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Condition:</span>
                  <span className="font-medium">
                    Probability {formData.condition_type === 'THRESHOLD_ABOVE' ? '>' : '<'}{' '}
                    {formData.threshold_probability}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Action:</span>
                  <span className="font-medium">
                    Swap {formData.swap_percentage}% to{' '}
                    {formData.trigger_type === 'SWAP_TO_STABLECOIN' ? 'USDC' : 'SOL'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cooldown:</span>
                  <span className="font-medium">{formData.cooldown_hours} hours</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
                <p className="text-sm">
                  Your rule will activate immediately and monitor{' '}
                  <strong>{platform === 'kalshi' ? 'Kalshi' : 'Polymarket'}</strong>{' '}
                  probability. You can pause or delete it anytime from the dashboard.
                  {platform === 'polymarket' && (
                    <span className="block mt-1 text-yellow-700 dark:text-yellow-300">
                      Note: Polymarket execution is in stub mode — the swap will be logged but
                      not executed on-chain until Phase 2.
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? 'Creating Rule...' : 'Create Rule & Activate'}
          </Button>
        </div>
      </main>
    </div>
  );
}
