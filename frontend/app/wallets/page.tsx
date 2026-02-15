'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Copy,
  Plus,
  Wallet,
  ExternalLink,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function WalletsPage() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: apiClient.getWallets,
  });

  const createWalletMutation = useMutation({
    mutationFn: (name: string) => apiClient.createWallet(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setShowCreateDialog(false);
      setNewWalletName('');
      toast.success('Wallet created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create wallet');
    },
  });

  const copyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast.success('Address copied to clipboard!');
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleCreateWallet = () => {
    if (!newWalletName.trim()) {
      toast.error('Please enter a wallet name');
      return;
    }
    createWalletMutation.mutate(newWalletName);
  };

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
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Automation Wallets</h1>
            <p className="text-muted-foreground">
              Manage wallets used for automated trading
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Wallet
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : wallets && wallets.length > 0 ? (
          <div className="grid gap-6">
            {wallets.map((wallet: any) => (
              <Card key={wallet.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    {wallet.name}
                  </CardTitle>
                  <CardDescription>Created {new Date(wallet.created_at).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Public Address</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono">
                        {wallet.public_key}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(wallet.public_key)}
                      >
                        {copiedAddress === wallet.public_key ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={`https://solscan.io/account/${wallet.public_key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label className="text-xs text-muted-foreground">SOL Balance</Label>
                      <p className="text-2xl font-bold mt-1">
                        {wallet.balance?.toFixed(4) || '0.0000'} SOL
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ≈ ${((wallet.balance || 0) * 180).toFixed(2)} USD
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">USDC Balance</Label>
                      <p className="text-2xl font-bold mt-1">
                        {wallet.usdc_balance?.toFixed(2) || '0.00'} USDC
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ≈ ${wallet.usdc_balance?.toFixed(2) || '0.00'} USD
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1">
                      Fund Wallet
                    </Button>
                    <Button variant="outline" className="flex-1">
                      View History
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No wallets yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first automation wallet to get started
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Wallet
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create Wallet Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Wallet</CardTitle>
              <CardDescription>
                A new Solana wallet will be generated for automated trading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="walletName">Wallet Name</Label>
                <Input
                  id="walletName"
                  placeholder="e.g., Primary Automation Wallet"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  className="mt-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateWallet();
                    }
                  }}
                />
              </div>

              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-3">
                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                  <strong>Important:</strong> Make sure to fund this wallet with SOL and/or USDC
                  before activating rules that use it.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setNewWalletName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateWallet}
                  disabled={createWalletMutation.isPending}
                >
                  {createWalletMutation.isPending ? 'Creating...' : 'Create Wallet'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
