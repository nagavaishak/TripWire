'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ArrowLeft, Check, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const STEPS = ['Market', 'Condition', 'Action', 'Review'];

export default function CreateRulePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    kalshi_market_id: '',
    condition_type: 'THRESHOLD_ABOVE',
    threshold_probability: 65,
    trigger_type: 'SWAP_TO_STABLECOIN',
    automation_wallet_id: 1,
    swap_percentage: 80,
    cooldown_hours: 24,
  });

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: apiClient.getWallets,
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: any) => apiClient.createRule(data),
    onSuccess: () => {
      toast.success('Rule created successfully!');
      router.push('/');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create rule');
    },
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    // Convert threshold from percentage to decimal
    const ruleData = {
      ...formData,
      threshold_probability: formData.threshold_probability / 100,
    };
    createRuleMutation.mutate(ruleData);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create New Rule</h1>
          <p className="text-muted-foreground">
            Automate your portfolio based on real-world event probabilities
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  index <= currentStep
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground text-muted-foreground'
                }`}
              >
                {index < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={`ml-2 text-sm ${
                  index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-4 ${
                    index < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Step 1: Select Market */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Recession Hedge"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="market">Kalshi Market ID</Label>
                  <Input
                    id="market"
                    placeholder="e.g., INXD-26DEC29"
                    value={formData.kalshi_market_id}
                    onChange={(e) => updateField('kalshi_market_id', e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Find market IDs at{' '}
                    <a
                      href="https://kalshi.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      kalshi.com
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Set Condition */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base mb-4 block">
                    When should this rule trigger?
                  </Label>
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
              </div>
            )}

            {/* Step 3: Choose Action */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base mb-4 block">What action should be taken?</Label>
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
                      <div>
                        <div className="font-medium">Swap to Stablecoin (USDC)</div>
                        <div className="text-sm text-muted-foreground">
                          Convert SOL to USDC for stability
                        </div>
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
                      <div>
                        <div className="font-medium">Swap to SOL</div>
                        <div className="text-sm text-muted-foreground">
                          Convert USDC to SOL for growth exposure
                        </div>
                      </div>
                    </button>
                  </div>
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
              </div>
            )}

            {/* Step 4: Review & Activate */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-4">Rule Summary</h3>
                  <div className="space-y-3 rounded-lg bg-muted/50 p-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{formData.name || 'Unnamed Rule'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Market:</span>
                      <span className="font-medium">{formData.kalshi_market_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trigger Condition:</span>
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
                </div>

                <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
                  <p className="text-sm">
                    Your rule will be activated immediately and start monitoring the market. You
                    can pause or delete it anytime from the dashboard.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createRuleMutation.isPending}
            >
              {createRuleMutation.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
