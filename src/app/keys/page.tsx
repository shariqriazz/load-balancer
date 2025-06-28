'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Key, 
  Activity, 
  AlertTriangle, 
  Clock,
  MoreHorizontal,
  Filter,
  Search,
  Move,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  ChevronDown,
  Users,
  ArrowRight
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

interface ApiKey {
  _id: string;
  key: string;
  name?: string;
  profile?: string;
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null;
  failureCount: number;
  requestCount: number;
  dailyRateLimit?: number | null;
  dailyRequestsUsed: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;
}

interface Profile {
  name: string;
  description: string;
  color: string;
  icon: string;
  keyCount: number;
  activeKeys: number;
  rateLimitedKeys: number;
  inactiveKeys: number;
  totalRequests: number;
  dailyRequestsUsed: number;
  avgDailyLimit: number | null;
  lastUsed: string | null;
  isDefault: boolean;
}

function KeysPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Dialog states
  const [addKeyDialogOpen, setAddKeyDialogOpen] = useState(false);
  const [editKeyDialogOpen, setEditKeyDialogOpen] = useState(false);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [newKey, setNewKey] = useState({
    key: '',
    name: '',
    profile: '',
    dailyRateLimit: '',
    newProfileName: ''
  });

  useEffect(() => {
    // Get profile from URL params
    const profileParam = searchParams.get('profile');
    if (profileParam) {
      setSelectedProfile(profileParam);
    }
    
    fetchData();
  }, [searchParams]);

  const fetchData = async () => {
    try {
      const [keysResponse, profilesResponse] = await Promise.all([
        fetch('/api/admin/keys'),
        fetch('/api/admin/profiles')
      ]);

      if (!keysResponse.ok || !profilesResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [keysData, profilesData] = await Promise.all([
        keysResponse.json(),
        profilesResponse.json()
      ]);

      setKeys(keysData);
      setProfiles(profilesData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch keys and profiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addKey = async () => {
    try {
      let profileToUse = newKey.profile;
      
      // Handle new profile creation
      if (newKey.profile === '__create_new__') {
        if (!newKey.newProfileName.trim()) {
          toast({
            title: "Error",
            description: "Please enter a name for the new profile",
            variant: "destructive",
          });
          return;
        }
        
        // Create new profile first
        const profileResponse = await fetch('/api/admin/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newKey.newProfileName.trim(),
            description: `Profile for ${newKey.newProfileName.trim()} API keys`,
            color: '#6366f1' // Default color
          })
        });
        
        if (!profileResponse.ok) {
          const error = await profileResponse.json();
          throw new Error(error.error || 'Failed to create profile');
        }
        
        profileToUse = newKey.newProfileName.trim();
      }

      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.key,
          name: newKey.name || undefined,
          profile: profileToUse || undefined,
          dailyRateLimit: newKey.dailyRateLimit ? parseInt(newKey.dailyRateLimit) : null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add key');
      }

      toast({
        title: "Success",
        description: newKey.profile === '__create_new__' 
          ? `Profile "${profileToUse}" created and API key added successfully`
          : "API key added successfully",
      });

      setAddKeyDialogOpen(false);
      setNewKey({ key: '', name: '', profile: '', dailyRateLimit: '', newProfileName: '' });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const editKey = async () => {
    if (!editingKey) return;
    
    try {
      const response = await fetch(`/api/admin/keys/${editingKey._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKey.name || undefined,
          profile: newKey.profile || undefined,
          dailyRateLimit: newKey.dailyRateLimit ? parseInt(newKey.dailyRateLimit) : null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update key');
      }

      toast({
        title: "Success",
        description: "API key updated successfully",
      });

      setEditKeyDialogOpen(false);
      setEditingKey(null);
      setNewKey({ key: '', name: '', profile: '', dailyRateLimit: '', newProfileName: '' });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (key: ApiKey) => {
    setEditingKey(key);
    setNewKey({
      key: key.key,
      name: key.name || '',
      profile: key.profile || '',
      dailyRateLimit: key.dailyRateLimit?.toString() || '',
      newProfileName: ''
    });
    setEditKeyDialogOpen(true);
  };

  const deleteKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/admin/keys/${keyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete key');

      toast({
        title: "Success",
        description: "API key deleted successfully",
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete key",
        variant: "destructive",
      });
    }
  };

  const moveKeys = async (targetProfile: string) => {
    try {
      const response = await fetch('/api/admin/keys/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyIds: Array.from(selectedKeys),
          targetProfile
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to move keys');
      }

      toast({
        title: "Success",
        description: `Moved ${selectedKeys.size} keys to ${targetProfile}`,
      });

      setSelectedKeys(new Set());
      setBulkMoveDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const bulkEditDailyLimit = async (dailyLimit: number | null) => {
    try {
      const response = await fetch('/api/admin/keys/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setLimit',
          keyIds: Array.from(selectedKeys),
          dailyRequestLimit: dailyLimit
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update daily limits');
      }

      toast({
        title: "Success",
        description: `Updated daily limit for ${selectedKeys.size} keys`,
      });

      setSelectedKeys(new Set());
      setBulkEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredKeys = keys.filter(key => {
    // Profile filter
    if (selectedProfile !== 'all') {
      const keyProfile = key.profile || 'default';
      if (keyProfile !== selectedProfile) return false;
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (
        !key.name?.toLowerCase().includes(searchLower) &&
        !key.key.toLowerCase().includes(searchLower) &&
        !(key.profile || 'default').toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Active filter
    if (!showInactive && (!key.isActive || key.isDisabledByRateLimit)) {
      return false;
    }

    return true;
  });

  const groupedKeys = filteredKeys.reduce((groups, key) => {
    const profile = key.profile || 'default';
    if (!groups[profile]) {
      groups[profile] = [];
    }
    groups[profile].push(key);
    return groups;
  }, {} as Record<string, ApiKey[]>);

  const getKeyStatus = (key: ApiKey) => {
    if (!key.isActive) return { status: 'inactive', color: 'bg-red-500', text: 'Inactive' };
    if (key.isDisabledByRateLimit) return { status: 'rate-limited', color: 'bg-yellow-500', text: 'Rate Limited' };
    if (key.rateLimitResetAt && new Date(key.rateLimitResetAt) > new Date()) {
      return { status: 'cooldown', color: 'bg-orange-500', text: 'Cooldown' };
    }
    return { status: 'active', color: 'bg-green-500', text: 'Active' };
  };

  const formatLastUsed = (lastUsed: string | null) => {
    if (!lastUsed) return 'Never';
    const date = new Date(lastUsed);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const toggleKeySelection = (keyId: string) => {
    const newSelected = new Set(selectedKeys);
    if (newSelected.has(keyId)) {
      newSelected.delete(keyId);
    } else {
      newSelected.add(keyId);
    }
    setSelectedKeys(newSelected);
  };

  const selectAllKeys = () => {
    if (selectedKeys.size === filteredKeys.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredKeys.map(k => k._id)));
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ErrorBoundary>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
              <p className="text-muted-foreground">
                Manage your API keys organized by profiles for optimal load balancing
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => router.push('/profiles')}>
                <Users className="h-4 w-4 mr-2" />
                Manage Profiles
              </Button>
              <Dialog open={addKeyDialogOpen} onOpenChange={(open) => {
                setAddKeyDialogOpen(open);
                if (open) {
                  // Pre-select current profile if viewing a specific profile
                  if (selectedProfile !== 'all') {
                    setNewKey(prev => ({ ...prev, profile: selectedProfile }));
                  }
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Key
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New API Key</DialogTitle>
                    <DialogDescription>
                      Add a new API key to a profile for load balancing
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="profile">Profile *</Label>
                      <div className="text-sm text-muted-foreground mb-2">
                        Choose which profile this key belongs to. Keys in the same profile are load-balanced together.
                      </div>
                      <Select value={newKey.profile} onValueChange={(value) => setNewKey({ ...newKey, profile: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a profile" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((profile) => (
                            <SelectItem key={profile.name} value={profile.name}>
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-2">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: profile.color }}
                                  />
                                  <span>{profile.name}</span>
                                  {profile.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {profile.keyCount} keys
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                          <SelectItem value="__create_new__">
                            <div className="flex items-center space-x-2 text-primary">
                              <Plus className="w-3 h-3" />
                              <span>Create New Profile</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {newKey.profile === '__create_new__' && (
                        <div className="mt-2 p-3 border rounded-lg bg-muted/50">
                          <div className="text-sm font-medium mb-2">Create New Profile</div>
                          <Input
                            placeholder="Profile name (e.g., 'OpenAI Production')"
                            value={newKey.newProfileName || ''}
                            onChange={(e) => setNewKey({ ...newKey, newProfileName: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="key">API Key *</Label>
                      <Input
                        id="key"
                        type="password"
                        value={newKey.key}
                        onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                        placeholder="sk-..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="name">Name (Optional)</Label>
                      <Input
                        id="name"
                        value={newKey.name}
                        onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                        placeholder="Descriptive name for this key"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dailyLimit">Daily Rate Limit (Optional)</Label>
                      <Input
                        id="dailyLimit"
                        type="number"
                        value={newKey.dailyRateLimit}
                        onChange={(e) => setNewKey({ ...newKey, dailyRateLimit: e.target.value })}
                        placeholder="e.g., 1000"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddKeyDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={addKey} 
                      disabled={
                        !newKey.key.trim() || 
                        !newKey.profile || 
                        (newKey.profile === '__create_new__' && !newKey.newProfileName.trim())
                      }
                    >
                      {newKey.profile === '__create_new__' ? 'Create Profile & Add Key' : 'Add Key'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Profile Filter */}
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Profiles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Profiles</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.name} value={profile.name}>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: profile.color }}
                        />
                        <span>{profile.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {profile.keyCount}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keys..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>

              {/* Show Inactive Toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={(checked) => setShowInactive(checked === true)}
                />
                <Label htmlFor="show-inactive" className="text-sm">
                  Show inactive keys
                </Label>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedKeys.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {selectedKeys.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkMoveDialogOpen(true)}
                >
                  <Move className="h-4 w-4 mr-2" />
                  Move to Profile
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkEditDialogOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Limits
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Selected Keys</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedKeys.size} selected keys? 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => {
                          // Implement bulk delete
                          selectedKeys.forEach(keyId => deleteKey(keyId));
                          setSelectedKeys(new Set());
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Keys Display */}
          {selectedProfile === 'all' ? (
            // Grouped by Profile View
            <div className="space-y-6">
              {Object.entries(groupedKeys).map(([profileName, profileKeys]) => {
                const profile = profiles.find(p => p.name === profileName);
                return (
                  <Card key={profileName}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: profile?.color || '#6366f1' }}
                          />
                          <CardTitle className="text-lg">{profileName}</CardTitle>
                          <Badge variant="outline">{profileKeys.length} keys</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProfile(profileName)}
                        >
                          View All <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                      {profile?.description && (
                        <CardDescription>{profile.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {profileKeys.slice(0, 3).map((key) => {
                          const status = getKeyStatus(key);
                          return (
                            <div key={key._id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  checked={selectedKeys.has(key._id)}
                                  onCheckedChange={() => toggleKeySelection(key._id)}
                                />
                                <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                <div>
                                  <div className="font-medium">
                                    {key.name || 'Unnamed Key'}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {key.key} • {formatLastUsed(key.lastUsed)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant={status.status === 'active' ? 'default' : 'secondary'}>
                                  {status.text}
                                </Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(key)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Move className="h-4 w-4 mr-2" />
                                      Move to Profile
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-red-600"
                                      onClick={() => deleteKey(key._id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                        {profileKeys.length > 3 && (
                          <div className="text-center py-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedProfile(profileName)}
                            >
                              View {profileKeys.length - 3} more keys
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Single Profile Detailed View
            <div className="space-y-4">
              {/* Profile Header */}
              {selectedProfile !== 'all' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProfile('all')}
                        >
                          ← Back to All Profiles
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAllKeys}
                        >
                          {selectedKeys.size === filteredKeys.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

              {/* Keys List */}
              <div className="grid gap-3">
                {filteredKeys.map((key) => {
                  const status = getKeyStatus(key);
                  return (
                    <Card key={key._id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={selectedKeys.has(key._id)}
                              onCheckedChange={() => toggleKeySelection(key._id)}
                            />
                            <div className={`w-3 h-3 rounded-full ${status.color}`} />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">
                                  {key.name || 'Unnamed Key'}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {key.profile || 'default'}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {key.key}
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                                <span>Requests: {key.requestCount.toLocaleString()}</span>
                                <span>Daily: {key.dailyRequestsUsed}/{key.dailyRateLimit || '∞'}</span>
                                <span>Last used: {formatLastUsed(key.lastUsed)}</span>
                                {key.failureCount > 0 && (
                                  <span className="text-red-600">Failures: {key.failureCount}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={status.status === 'active' ? 'default' : 'secondary'}>
                              {status.text}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(key)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Move className="h-4 w-4 mr-2" />
                                  Move to Profile
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => deleteKey(key._id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredKeys.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No keys found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm ? 'No keys match your search criteria.' : 'No keys in this profile yet.'}
                    </p>
                    <Button onClick={() => setAddKeyDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Key
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Edit Key Dialog */}
          <Dialog open={editKeyDialogOpen} onOpenChange={setEditKeyDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit API Key</DialogTitle>
                <DialogDescription>
                  Update the key details and settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={newKey.name}
                    onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                    placeholder="Descriptive name for this key"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-profile">Profile</Label>
                  <Select value={newKey.profile} onValueChange={(value) => setNewKey({ ...newKey, profile: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.name} value={profile.name}>
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: profile.color }}
                            />
                            <span>{profile.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-dailyLimit">Daily Rate Limit</Label>
                  <Input
                    id="edit-dailyLimit"
                    type="number"
                    value={newKey.dailyRateLimit}
                    onChange={(e) => setNewKey({ ...newKey, dailyRateLimit: e.target.value })}
                    placeholder="e.g., 1000 (leave empty for no limit)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditKeyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editKey}>
                  Update Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk Move Dialog */}
          <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Move Keys to Profile</DialogTitle>
                <DialogDescription>
                  Move {selectedKeys.size} selected keys to a different profile
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Label>Target Profile</Label>
                <Select onValueChange={(value) => moveKeys(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.name} value={profile.name}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: profile.color }}
                          />
                          <span>{profile.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkMoveDialogOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk Edit Daily Limits Dialog */}
          <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Daily Limits</DialogTitle>
                <DialogDescription>
                  Set daily rate limit for {selectedKeys.size} selected keys
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bulk-daily-limit">Daily Rate Limit</Label>
                  <Input
                    id="bulk-daily-limit"
                    type="number"
                    placeholder="e.g., 1000 (leave empty to remove limit)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value;
                        bulkEditDailyLimit(value ? parseInt(value) : null);
                      }
                    }}
                  />
                  <div className="text-sm text-muted-foreground mt-1">
                    Leave empty to remove daily limits from selected keys
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  const input = document.getElementById('bulk-daily-limit') as HTMLInputElement;
                  const value = input?.value;
                  bulkEditDailyLimit(value ? parseInt(value) : null);
                }}>
                  Update Limits
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ErrorBoundary>
    </AppLayout>
  );
}

export default function KeysPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <KeysPageContent />
    </Suspense>
  );
}