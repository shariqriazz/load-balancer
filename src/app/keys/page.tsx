'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import KeyStats from '@/components/keys/KeyStats';
import { cn } from "@/lib/utils";

interface ApiKey {
  _id: string;
  key: string;
  name?: string;
  profile?: string | null; // Profile name for key grouping
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null; // Global rate limit
  failureCount: number;
  requestCount: number; // Total requests
  // New fields for daily rate limiting
  dailyRateLimit?: number | null;
  dailyRequestsUsed: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyProfile, setNewKeyProfile] = useState(''); // State for profile
  const [newKeyDailyRateLimit, setNewKeyDailyRateLimit] = useState(''); // State for daily rate limit
  const [existingProfiles, setExistingProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  // Custom onOpen handler to reset form state
  const onOpen = () => {
    setNewKey('');
    setNewKeyName('');
    setNewKeyDailyRateLimit('');
    setSelectedProfile('');
    setIsCreatingNewProfile(false);
    setNewProfileName('');
    setIsModalOpen(true);
  };

  // Custom onClose handler
  const onClose = () => {
    setIsModalOpen(false);
  };

  const fetchKeys = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/keys');
      if (!response.ok) {
        throw new Error(`Error fetching keys: ${response.statusText}`);
      }
      const data = await response.json();
      setKeys(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch API keys');
      console.error('Error fetching keys:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Extract unique profiles from keys
  const extractProfiles = (keys: ApiKey[]): string[] => {
    const profileSet = new Set<string>();

    keys.forEach(key => {
      if (key.profile && key.profile.trim() !== '') {
        profileSet.add(key.profile.trim());
      }
    });

    return Array.from(profileSet).sort();
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // Update existing profiles whenever keys change
  useEffect(() => {
    const profiles = extractProfiles(keys);
    setExistingProfiles(profiles);
  }, [keys]);

  const handleAddKey = async () => {
    if (!newKey.trim()) {
      toast({
        title: 'Error',
        description: 'API key cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    // Determine which profile to use
    let profileToUse = '';

    if (isCreatingNewProfile) {
      if (!newProfileName.trim()) {
        toast({
          title: 'Error',
          description: 'Profile name cannot be empty when creating a new profile',
          variant: 'destructive',
        });
        return;
      }
      profileToUse = newProfileName.trim();
    } else {
      profileToUse = selectedProfile;
    }

    try {
      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: newKey,
          name: newKeyName,
          profile: profileToUse, // Use the determined profile
          dailyRateLimit: newKeyDailyRateLimit.trim() === '' ? null : newKeyDailyRateLimit // Send null if empty, otherwise the value
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add API key');
      }

      toast({
        title: 'Success',
        description: 'API key added successfully',
      });

      // Reset all form fields
      setNewKey('');
      setNewKeyName('');
      setNewKeyDailyRateLimit(''); // Reset daily rate limit state
      setSelectedProfile('');
      setIsCreatingNewProfile(false);
      setNewProfileName('');
      onClose();
      fetchKeys();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add API key',
        variant: 'destructive',
      });
    }
  };

  // Handle profile selection change
  const handleProfileChange = (value: string) => {
    if (value === "new") {
      setIsCreatingNewProfile(true);
      setSelectedProfile("");
    } else {
      setIsCreatingNewProfile(false);
      setSelectedProfile(value);
    }
  };

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
              <p className="text-sm text-muted-foreground">Manage your API keys</p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Refresh Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={fetchKeys} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    <span className="sr-only">Refresh keys</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh Keys</p>
                </TooltipContent>
              </Tooltip>

              {/* Add New Key Dialog Trigger */}
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button onClick={onOpen}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Key
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New API Key</DialogTitle>
                    <DialogDescription>
                      Configure a new API key for the load balancer.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    {/* Step 1: Profile Selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="profile" className="text-right">
                        Profile <span className="text-destructive">*</span>
                      </Label>
                      <div className="col-span-3">
                        <Select
                          value={isCreatingNewProfile ? "new" : selectedProfile}
                          onValueChange={handleProfileChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a profile" />
                          </SelectTrigger>
                          <SelectContent>
                            {existingProfiles.map(profile => (
                              <SelectItem key={profile} value={profile}>{profile}</SelectItem>
                            ))}
                            <SelectItem value="new">+ Create New Profile</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Show input for new profile name if creating new profile */}
                    {isCreatingNewProfile && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="newProfileName" className="text-right">
                          New Profile <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="newProfileName"
                          placeholder="e.g., Google, OpenAI, Anthropic"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          className="col-span-3"
                        />
                      </div>
                    )}

                    {/* Only show the rest of the form if a profile is selected or creating new profile */}
                    {(selectedProfile || isCreatingNewProfile) && (
                      <>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="apiKey" className="text-right">
                            API Key <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="apiKey"
                            placeholder="Enter your API key"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            className="col-span-3"
                          />
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="keyName" className="text-right">
                            Key Name
                          </Label>
                          <Input
                            id="keyName"
                            placeholder="e.g., My Test Key"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            className="col-span-3"
                          />
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="dailyRateLimit" className="text-right">
                            Daily Rate Limit
                          </Label>
                          <Input
                            id="dailyRateLimit"
                            type="number"
                            placeholder="e.g., 100 (leave empty for no limit)"
                            value={newKeyDailyRateLimit}
                            onChange={(e) => setNewKeyDailyRateLimit(e.target.value)}
                            min="0"
                            className="col-span-3"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button 
                      onClick={handleAddKey}
                      disabled={!(selectedProfile || (isCreatingNewProfile && newProfileName.trim()))}
                    >
                      Add Key
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error!</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <KeyStats />
          )}
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}