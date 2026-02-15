'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Bell,
  Copy,
  Key,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [webhookForm, setWebhookForm] = useState({
    type: 'HTTP',
    url: '',
  });

  useEffect(() => {
    const key = localStorage.getItem('tripwire_api_key');
    setApiKey(key);
  }, []);

  const { data: webhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: apiClient.getWebhooks,
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: any) => apiClient.createWebhook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowCreateWebhook(false);
      setWebhookForm({ type: 'HTTP', url: '' });
      toast.success('Webhook created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create webhook');
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete webhook');
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: (id: number) => apiClient.testWebhook(id),
    onSuccess: () => {
      toast.success('Test notification sent!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to send test');
    },
  });

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopiedKey(true);
      toast.success('API key copied to clipboard!');
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCreateWebhook = () => {
    if (!webhookForm.url.trim()) {
      toast.error('Please enter a webhook URL');
      return;
    }

    createWebhookMutation.mutate({
      type: webhookForm.type,
      url: webhookForm.url,
      events: ['RULE_TRIGGERED', 'EXECUTION_SUCCEEDED', 'EXECUTION_FAILED'],
      enabled: true,
    });
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account, API keys, and notifications
          </p>
        </div>

        <div className="space-y-6">
          {/* API Key Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Key
              </CardTitle>
              <CardDescription>
                Use this API key to authenticate with the TripWire API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKey ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Your API Key</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono">
                      {apiKey.slice(0, 20)}...{apiKey.slice(-10)}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyApiKey}>
                      {copiedKey ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Keep this key secure. Do not share it publicly.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-3">
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    Please sign in to view your API key
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhooks Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Webhook Notifications
                  </CardTitle>
                  <CardDescription>
                    Get real-time notifications when rules trigger
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreateWebhook(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {webhooksLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : webhooks && webhooks.length > 0 ? (
                <div className="space-y-3">
                  {webhooks.map((webhook: any) => (
                    <div
                      key={webhook.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">{webhook.type}</Badge>
                          <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
                            {webhook.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">
                          {webhook.url.length > 50
                            ? `${webhook.url.slice(0, 50)}...`
                            : webhook.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhookMutation.mutate(webhook.id)}
                          disabled={testWebhookMutation.isPending}
                        >
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                          disabled={deleteWebhookMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No webhooks configured</p>
                  <p className="text-xs mt-1">Add a webhook to receive notifications</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* About Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                About TripWire
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>API Endpoint</span>
                <span className="font-medium">http://localhost:3000</span>
              </div>
              <div className="flex justify-between">
                <span>Documentation</span>
                <a href="#" className="font-medium text-primary hover:underline">
                  View Docs
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Create Webhook Dialog */}
      {showCreateWebhook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Webhook</CardTitle>
              <CardDescription>
                Configure a webhook to receive real-time notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="webhookType">Webhook Type</Label>
                <select
                  id="webhookType"
                  value={webhookForm.type}
                  onChange={(e) =>
                    setWebhookForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="HTTP">HTTP (Custom endpoint)</option>
                  <option value="SLACK">Slack</option>
                  <option value="DISCORD">Discord</option>
                </select>
              </div>

              <div>
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  placeholder={
                    webhookForm.type === 'SLACK'
                      ? 'https://hooks.slack.com/services/...'
                      : webhookForm.type === 'DISCORD'
                      ? 'https://discord.com/api/webhooks/...'
                      : 'https://your-server.com/webhook'
                  }
                  value={webhookForm.url}
                  onChange={(e) =>
                    setWebhookForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                  className="mt-2"
                />
              </div>

              <div className="rounded-lg border border-blue-500/50 bg-blue-500/5 p-3">
                <p className="text-xs text-blue-600 dark:text-blue-500">
                  You'll receive notifications for rule triggers, successful executions, and
                  failures.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateWebhook(false);
                    setWebhookForm({ type: 'HTTP', url: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateWebhook}
                  disabled={createWebhookMutation.isPending}
                >
                  {createWebhookMutation.isPending ? 'Creating...' : 'Create Webhook'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
