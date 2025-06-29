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
import { Activity, Key, Cpu, AlertCircle, RefreshCw, AlertTriangle, Loader2, Users, ArrowRight } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import KeyStats from '@/components/keys/KeyStats';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState("24h");
  const [isLoading, setIsLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState({
    totalKeys: 0,
    activeKeys: 0,
    totalRequests: 0,
    totalRequestsToday: 0,
    totalRequests24h: 0,
    errorRate: 0
  });
  
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const keysResponse = await fetch('/api/admin/keys');
      if (!keysResponse.ok) {
        throw new Error(`Error fetching keys: ${keysResponse.statusText}`);
      }
      const keysData = await keysResponse.json();
      
      const statsResponse = await fetch(`/api/stats?timeRange=${timeRange}`);
      if (!statsResponse.ok) {
        throw new Error(`Error fetching stats: ${statsResponse.statusText}`);
      }
      const statsData = await statsResponse.json();
      
      const totalKeys = keysData.length;
      const activeKeys = keysData.filter((key: any) => key.isActive).length;
      const totalRequests = statsData.totalRequests || 0;
      const totalRequestsToday = statsData.totalRequestsToday || 0;
      const totalRequests24h = statsData.totalRequests24h || 0;
      
      const relevantTotalRequestsForErrorRate = totalRequests24h > 0 ? totalRequests24h : totalRequests;
      const errorRate = relevantTotalRequestsForErrorRate > 0 && statsData.apiKeyErrors !== undefined
        ? ((statsData.apiKeyErrors / relevantTotalRequestsForErrorRate) * 100).toFixed(1)
        : 0;
      
      setStats({
        totalKeys,
        activeKeys,
        totalRequests,
        totalRequestsToday,
        totalRequests24h,
        errorRate: parseFloat(errorRate as string)
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message || 'Failed to fetch dashboard data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfiles = async () => {
    setProfilesLoading(true);
    try {
      const response = await fetch('/api/admin/profiles');
      if (!response.ok) {
        throw new Error(`Error fetching profiles: ${response.statusText}`);
      }
      const profilesData = await response.json();
      setProfiles(profilesData);
    } catch (err: any) {
      console.error('Error fetching profiles:', err);
      // Don't show toast for profile errors, just log them
    } finally {
      setProfilesLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const formatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return "N/A";
    }
    return value.toLocaleString();
  };

  const formatPercentage = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return "N/A";
    }
    return `${value.toFixed(1)}%`;
  };

  const renderLoading = () => (
      <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading dashboard...</p>
      </div>
  );

  const renderError = () => (
       <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Fetching Dashboard Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
       </Alert>
  );

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of your Load Balancer</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Actions */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/keys'}
              className="hidden sm:flex"
            >
              <Key className="h-4 w-4 mr-2" />
              Add Keys
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/profiles'}
              className="hidden md:flex"
            >
              <Users className="h-4 w-4 mr-2" />
              Profiles
            </Button>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={fetchStats} disabled={isLoading}>
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="sr-only">Refresh dashboard</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh Dashboard</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {error && renderError()}

        {!isClient || isLoading ? (
          renderLoading()
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
              <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-1)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Key className="h-5 w-5 text-[hsl(var(--chart-1))] mr-2" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Keys</p>
                      <h2 className="text-3xl font-bold">{formatNumber(stats.totalKeys)}</h2>
                      <p className="text-xs text-muted-foreground mt-1">API Keys Configured</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-2)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 text-[hsl(var(--chart-2))] mr-2" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Keys</p>
                      <h2 className="text-3xl font-bold">{formatNumber(stats.activeKeys)}</h2>
                      <p className="text-xs text-muted-foreground mt-1">Ready for Use</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-3)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Cpu className="h-5 w-5 text-[hsl(var(--chart-3))] mr-2" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Requests (24h)</p>
                      <h2 className="text-3xl font-bold">{formatNumber(stats.totalRequests24h)}</h2>
                      <p className="text-xs text-muted-foreground mt-1">Last 24 Hours (Logs)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-4)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Cpu className="h-5 w-5 text-[hsl(var(--chart-4))] mr-2" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Requests (Today)</p>
                      <h2 className="text-3xl font-bold">{formatNumber(stats.totalRequestsToday)}</h2>
                      <p className="text-xs text-muted-foreground mt-1">Since Midnight (DB)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-5)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Cpu className="h-5 w-5 text-[hsl(var(--chart-5))] mr-2" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Requests (Lifetime)</p>
                      <h2 className="text-3xl font-bold">{formatNumber(stats.totalRequests)}</h2>
                      <p className="text-xs text-muted-foreground mt-1">All Time (DB)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-1)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-[hsl(var(--chart-1))] mr-2" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                      <h2 className="text-3xl font-bold">{formatPercentage(stats.errorRate)}</h2>
                      <p className="text-xs text-muted-foreground mt-1">Last 24 Hours</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profiles Overview */}
            <Card className="border-0 shadow-lg interactive-container hover-animate">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.05)] via-transparent to-[hsl(var(--secondary)/0.05)] pointer-events-none" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Profile Overview
                    </CardTitle>
                    <CardDescription>API key organization and load balancing profiles</CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={fetchProfiles} disabled={profilesLoading}>
                      <RefreshCw className={cn("h-4 w-4", profilesLoading && "animate-spin")} />
                    </Button>
                    <Button variant="outline" onClick={() => window.location.href = '/profiles'}>
                      Manage Profiles
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profilesLoading ? (
                    <div className="text-center text-muted-foreground py-8 col-span-full">
                      <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
                      <p className="text-sm">Loading profiles...</p>
                    </div>
                  ) : profiles.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 col-span-full">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No profiles found</p>
                      <p className="text-xs mt-1">Create your first profile to organize API keys</p>
                    </div>
                  ) : (
                    profiles.map((profile) => (
                      <Card key={profile.name} className="border border-border/50 hover:border-border transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: profile.color }}
                              />
                              <h3 className="font-medium text-sm">
                                {profile.name}
                                {profile.isDefault && (
                                  <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                                )}
                              </h3>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Keys:</span>
                              <span className="font-medium">{profile.keyCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Active:</span>
                              <span className="font-medium text-green-600">{profile.activeKeys}</span>
                            </div>
                            {profile.rateLimitedKeys > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Rate Limited:</span>
                                <span className="font-medium text-yellow-600">{profile.rateLimitedKeys}</span>
                              </div>
                            )}
                            {profile.inactiveKeys > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Inactive:</span>
                                <span className="font-medium text-red-600">{profile.inactiveKeys}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Requests:</span>
                              <span className="font-medium">{formatNumber(profile.totalRequests)}</span>
                            </div>
                            {profile.dailyRequestsUsed > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Today:</span>
                                <span className="font-medium">{formatNumber(profile.dailyRequestsUsed)}</span>
                              </div>
                            )}
                          </div>
                          
                          {profile.description && (
                            <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                              {profile.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg interactive-container hover-animate">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.05)] via-transparent to-[hsl(var(--secondary)/0.05)] pointer-events-none" />
              <CardHeader>
                <CardTitle>API Key Performance</CardTitle>
                <CardDescription>Current status and usage of individual API keys.</CardDescription>
              </CardHeader>
              <CardContent>
                <KeyStats />
              </CardContent>
            </Card>
          </>
        )}
      </TooltipProvider>
    </AppLayout>
  );
}