'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Plus, TestTube, Trash2, Edit, RefreshCw, BarChart3 } from 'lucide-react';

interface RovoDevKey {
  id: string;
  profile: string;
  email: string;
  apiToken: string;
  cloudId?: string;
  isInternal: boolean;
  isActive: boolean;
  lastUsed?: string;
  failureCount: number;
  requestCount: number;
  dailyTokensUsed: number;
  dailyTokenLimit: number;
  remainingTokens: number;
  isDisabledByRateLimit: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProfileStats {
  profile: string;
  summary: {
    totalKeys: number;
    activeKeys: number;
    totalTokensUsed: number;
    totalTokensRemaining: number;
    totalDailyLimit: number;
    usagePercentage: number;
  };
  keys: Array<{
    id: string;
    email: string;
    isActive: boolean;
    tokensUsed: number;
    tokensRemaining: number;
    tokenLimit: number;
    usagePercentage: number;
    isDisabledByRateLimit: boolean;
    lastUsed?: string;
    failureCount: number;
  }>;
}

import AppLayout from '@/components/layout/AppLayout';

function RovoDevKeysPageContent() {
  const [keys, setKeys] = useState<RovoDevKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<RovoDevKey | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const { toast } = useToast();

  // Form state for create/edit
  const [formData, setFormData] = useState({
    profile: '',
    email: '',
    apiToken: '',
    cloudId: '',
    dailyTokenLimit: 20000000
  });

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/admin/rovodev-keys');
      if (!response.ok) throw new Error('Failed to fetch RovoDev keys');
      const data = await response.json();
      setKeys(data.keys);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch RovoDev keys",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileStats = async (profile: string) => {
    if (!profile) return;
    
    setLoadingStats(true);
    try {
      const response = await fetch(`/api/admin/rovodev-keys/stats/${encodeURIComponent(profile)}`);
      if (!response.ok) throw new Error('Failed to fetch profile stats');
      const data = await response.json();
      setProfileStats(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch profile statistics",
        variant: "destructive",
      });
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      fetchProfileStats(selectedProfile);
    }
  }, [selectedProfile]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/admin/rovodev-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create RovoDev key');
      }

      toast({
        title: "Success",
        description: "RovoDev key created successfully",
      });

      setIsCreateDialogOpen(false);
      setFormData({ profile: '', email: '', apiToken: '', cloudId: '', dailyTokenLimit: 20000000 });
      fetchKeys();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;

    try {
      const response = await fetch(`/api/admin/rovodev-keys/${editingKey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update RovoDev key');
      }

      toast({
        title: "Success",
        description: "RovoDev key updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingKey(null);
      fetchKeys();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this RovoDev key?')) return;

    try {
      const response = await fetch(`/api/admin/rovodev-keys/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete RovoDev key');
      }

      toast({
        title: "Success",
        description: "RovoDev key deleted successfully",
      });

      fetchKeys();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTestKey = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/rovodev-keys/test/${id}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to test RovoDev key');
      }

      const data = await response.json();
      
      toast({
        title: data.valid ? "Success" : "Failed",
        description: data.message,
        variant: data.valid ? "default" : "destructive",
      });

      if (data.valid) {
        fetchKeys(); // Refresh to show updated stats
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSyncUsage = async (profile?: string) => {
    try {
      const response = await fetch('/api/admin/rovodev-keys/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile ? { profile } : {})
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync usage');
      }

      const data = await response.json();
      
      toast({
        title: "Success",
        description: data.message,
      });

      fetchKeys();
      if (selectedProfile) {
        fetchProfileStats(selectedProfile);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (key: RovoDevKey) => {
    setEditingKey(key);
    setFormData({
      profile: key.profile,
      email: key.email,
      apiToken: '', // Don't pre-fill for security
      cloudId: key.cloudId || '',
      dailyTokenLimit: key.dailyTokenLimit
    });
    setIsEditDialogOpen(true);
  };

  const toggleTokenVisibility = (keyId: string) => {
    setShowTokens(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const profiles = Array.from(new Set(keys.map(key => key.profile))).sort();

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">RovoDev Keys</h1>
          <p className="text-muted-foreground">
            Manage Atlassian RovoDev API keys for Claude Sonnet models
          </p>
          <Alert className="mt-4 max-w-2xl">
            <AlertDescription>
              <strong>Note:</strong> RovoDev integration is experimental. Connection tests may fail even with valid credentials 
              as we reverse-engineer the API. Keys will be saved and can be tested individually.
            </AlertDescription>
          </Alert>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleSyncUsage()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync All Usage
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add RovoDev Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create RovoDev Key</DialogTitle>
                <DialogDescription>
                  Add a new Atlassian RovoDev API key for accessing Claude Sonnet models
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div>
                  <Label htmlFor="profile">Profile</Label>
                  <Input
                    id="profile"
                    value={formData.profile}
                    onChange={(e) => setFormData({ ...formData, profile: e.target.value })}
                    placeholder="default"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@atlassian.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="apiToken">API Token</Label>
                  <Input
                    id="apiToken"
                    type="password"
                    value={formData.apiToken}
                    onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                    placeholder="Your RovoDev API token"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cloudId">Cloud ID (Optional)</Label>
                  <Input
                    id="cloudId"
                    value={formData.cloudId}
                    onChange={(e) => setFormData({ ...formData, cloudId: e.target.value })}
                    placeholder="Atlassian Cloud ID"
                  />
                </div>
                <div>
                  <Label htmlFor="dailyTokenLimit">Daily Token Limit</Label>
                  <Input
                    id="dailyTokenLimit"
                    type="number"
                    value={formData.dailyTokenLimit}
                    onChange={(e) => setFormData({ ...formData, dailyTokenLimit: parseInt(e.target.value) })}
                    min="1000"
                    max="100000000"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Key</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys">All Keys</TabsTrigger>
          <TabsTrigger value="stats">Profile Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <div className="grid gap-4">
            {keys.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground text-lg mb-4">No RovoDev keys found</p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First RovoDev Key
                  </Button>
                </CardContent>
              </Card>
            ) : (
              keys.map((key) => (
                <Card key={key.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {key.email}
                          <Badge variant={key.isActive ? "default" : "secondary"}>
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {key.isInternal && (
                            <Badge variant="outline">Internal</Badge>
                          )}
                          {key.isDisabledByRateLimit && (
                            <Badge variant="destructive">Rate Limited</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Profile: {key.profile} • Created: {formatDate(key.createdAt)}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTestKey(key.id)}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(key)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">API Token</Label>
                        <div className="flex items-center gap-2">
                          <code className="text-sm">
                            {showTokens[key.id] ? key.apiToken : key.apiToken.substring(0, 8) + '...'}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleTokenVisibility(key.id)}
                          >
                            {showTokens[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Daily Usage</Label>
                        <p className={`text-sm font-medium ${getUsageColor((key.dailyTokensUsed / key.dailyTokenLimit) * 100)}`}>
                          {formatNumber(key.dailyTokensUsed)} / {formatNumber(key.dailyTokenLimit)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {((key.dailyTokensUsed / key.dailyTokenLimit) * 100).toFixed(1)}% used
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Remaining Tokens</Label>
                        <p className="text-sm font-medium">{formatNumber(key.remainingTokens)}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Last Used</Label>
                        <p className="text-sm">{formatDate(key.lastUsed)}</p>
                        {key.failureCount > 0 && (
                          <p className="text-xs text-red-600">{key.failureCount} failures</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="profileSelect">Select Profile:</Label>
            <select
              id="profileSelect"
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">Choose a profile...</option>
              {profiles.map(profile => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </select>
            {selectedProfile && (
              <Button
                variant="outline"
                onClick={() => handleSyncUsage(selectedProfile)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Profile Usage
              </Button>
            )}
          </div>

          {loadingStats ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner />
            </div>
          ) : profileStats ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Profile Summary: {profileStats.profile}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Total Keys</Label>
                      <p className="text-2xl font-bold">{profileStats.summary.totalKeys}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Active Keys</Label>
                      <p className="text-2xl font-bold text-green-600">{profileStats.summary.activeKeys}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Tokens Used</Label>
                      <p className="text-2xl font-bold">{formatNumber(profileStats.summary.totalTokensUsed)}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Tokens Remaining</Label>
                      <p className="text-2xl font-bold">{formatNumber(profileStats.summary.totalTokensRemaining)}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Usage</Label>
                      <p className={`text-2xl font-bold ${getUsageColor(profileStats.summary.usagePercentage)}`}>
                        {profileStats.summary.usagePercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {profileStats.keys.map((key) => (
                  <Card key={key.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{key.email}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(key.tokensUsed)} / {formatNumber(key.tokenLimit)} tokens used
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${getUsageColor(key.usagePercentage)}`}>
                            {key.usagePercentage.toFixed(1)}%
                          </p>
                          <div className="flex gap-2">
                            {!key.isActive && <Badge variant="secondary">Inactive</Badge>}
                            {key.isDisabledByRateLimit && <Badge variant="destructive">Rate Limited</Badge>}
                            {key.failureCount > 0 && <Badge variant="outline">{key.failureCount} failures</Badge>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : selectedProfile ? (
            <Alert>
              <AlertDescription>
                No statistics available for the selected profile.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>
                Please select a profile to view statistics.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit RovoDev Key</DialogTitle>
            <DialogDescription>
              Update the RovoDev key settings
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateKey} className="space-y-4">
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@atlassian.com"
              />
            </div>
            <div>
              <Label htmlFor="editApiToken">API Token (leave empty to keep current)</Label>
              <Input
                id="editApiToken"
                type="password"
                value={formData.apiToken}
                onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                placeholder="Enter new API token to update"
              />
            </div>
            <div>
              <Label htmlFor="editCloudId">Cloud ID</Label>
              <Input
                id="editCloudId"
                value={formData.cloudId}
                onChange={(e) => setFormData({ ...formData, cloudId: e.target.value })}
                placeholder="Atlassian Cloud ID"
              />
            </div>
            <div>
              <Label htmlFor="editDailyTokenLimit">Daily Token Limit</Label>
              <Input
                id="editDailyTokenLimit"
                type="number"
                value={formData.dailyTokenLimit}
                onChange={(e) => setFormData({ ...formData, dailyTokenLimit: parseInt(e.target.value) })}
                min="1000"
                max="100000000"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Key</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RovoDevKeysPage() {
  return (
    <AppLayout>
      <RovoDevKeysPageContent />
    </AppLayout>
  );
}