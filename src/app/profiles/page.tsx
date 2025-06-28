'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Settings, 
  Trash2, 
  Key, 
  Activity, 
  AlertTriangle, 
  Clock,
  Users,
  BarChart3,
  Palette,
  Edit3
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useToast } from "@/hooks/use-toast";
import ErrorBoundary from '@/components/ErrorBoundary';

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

const PROFILE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6'
];

const PROFILE_ICONS = [
  'key', 'users', 'server', 'globe', 'shield', 'zap', 'star', 'heart'
];

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [newProfile, setNewProfile] = useState({
    name: '',
    description: '',
    color: PROFILE_COLORS[0],
    icon: PROFILE_ICONS[0]
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/admin/profiles');
      if (!response.ok) throw new Error('Failed to fetch profiles');
      const data = await response.json();
      setProfiles(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch profiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    try {
      const response = await fetch('/api/admin/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create profile');
      }

      toast({
        title: "Success",
        description: "Profile created successfully",
      });

      setCreateDialogOpen(false);
      setNewProfile({
        name: '',
        description: '',
        color: PROFILE_COLORS[0],
        icon: PROFILE_ICONS[0]
      });
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateProfile = async () => {
    if (!editingProfile) return;

    try {
      const response = await fetch(`/api/admin/profiles/${encodeURIComponent(editingProfile.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editingProfile.description,
          color: editingProfile.color,
          icon: editingProfile.icon
        })
      });

      if (!response.ok) throw new Error('Failed to update profile');

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      setEditingProfile(null);
      fetchProfiles();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const deleteProfile = async (profileName: string) => {
    try {
      const response = await fetch(`/api/admin/profiles/${encodeURIComponent(profileName)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete profile');
      }

      toast({
        title: "Success",
        description: "Profile deleted successfully",
      });

      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (profile: Profile) => {
    if (profile.rateLimitedKeys > 0) return 'text-yellow-600';
    if (profile.inactiveKeys > 0) return 'text-red-600';
    if (profile.activeKeys > 0) return 'text-green-600';
    return 'text-gray-500';
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
              <h1 className="text-3xl font-bold tracking-tight">Profiles</h1>
              <p className="text-muted-foreground">
                Organize your API keys into profiles for better management and load balancing
              </p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Profile</DialogTitle>
                  <DialogDescription>
                    Create a new profile to organize your API keys. Profiles help with load balancing and management.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Profile Name</Label>
                    <Input
                      id="name"
                      value={newProfile.name}
                      onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                      placeholder="e.g., OpenAI, Anthropic, Google"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      value={newProfile.description}
                      onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                      placeholder="Describe this profile's purpose"
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2 mt-2">
                      {PROFILE_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded-full border-2 ${
                            newProfile.color === color ? 'border-gray-900' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewProfile({ ...newProfile, color })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createProfile} disabled={!newProfile.name.trim()}>
                    Create Profile
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Profiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((profile) => (
              <Card key={profile.name} className="relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 w-full h-1"
                  style={{ backgroundColor: profile.color }}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: profile.color }}
                      >
                        <Key className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {profile.name}
                          {profile.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {profile.description || 'No description'}
                        </CardDescription>
                      </div>
                    </div>
                    {!profile.isDefault && (
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingProfile(profile)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Profile</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the "{profile.name}" profile? 
                                This action cannot be undone. All keys must be moved to other profiles first.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProfile(profile.name)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Key Statistics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{profile.keyCount}</div>
                      <div className="text-xs text-muted-foreground">Total Keys</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getStatusColor(profile)}`}>
                        {profile.activeKeys}
                      </div>
                      <div className="text-xs text-muted-foreground">Active</div>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center space-x-1">
                      <Activity className="h-4 w-4 text-green-500" />
                      <span>{profile.activeKeys} Active</span>
                    </div>
                    {profile.rateLimitedKeys > 0 && (
                      <div className="flex items-center space-x-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span>{profile.rateLimitedKeys} Limited</span>
                      </div>
                    )}
                    {profile.inactiveKeys > 0 && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4 text-red-500" />
                        <span>{profile.inactiveKeys} Inactive</span>
                      </div>
                    )}
                  </div>

                  {/* Usage Stats */}
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Requests:</span>
                      <span className="font-medium">{profile.totalRequests.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Daily Used:</span>
                      <span className="font-medium">{profile.dailyRequestsUsed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Used:</span>
                      <span className="font-medium">{formatLastUsed(profile.lastUsed)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.location.href = `/keys?profile=${encodeURIComponent(profile.name)}`}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Manage Keys ({profile.keyCount})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Edit Profile Dialog */}
          {editingProfile && (
            <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Profile: {editingProfile.name}</DialogTitle>
                  <DialogDescription>
                    Update the profile settings and appearance.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Input
                      id="edit-description"
                      value={editingProfile.description}
                      onChange={(e) => setEditingProfile({ 
                        ...editingProfile, 
                        description: e.target.value 
                      })}
                      placeholder="Describe this profile's purpose"
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2 mt-2">
                      {PROFILE_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded-full border-2 ${
                            editingProfile.color === color ? 'border-gray-900' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setEditingProfile({ ...editingProfile, color })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingProfile(null)}>
                    Cancel
                  </Button>
                  <Button onClick={updateProfile}>
                    Update Profile
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </ErrorBoundary>
    </AppLayout>
  );
}