'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useTheme } from 'next-themes';
import { Save, RefreshCw, Download, Upload, AlertCircle, CheckCircle, Loader2, BarChart3, Clock, Key } from 'lucide-react';
import { cn } from "@/lib/utils";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AppLayout from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';

interface Settings {
  keyRotationRequestCount: number;
  maxFailureCount: number;
  rateLimitCooldown: number;
  logRetentionDays: number;
  endpoint: string;
  failoverDelay: number;
  enableGoogleGrounding: boolean;
}

interface ApiEndpoint {
  name: string;
  value: string;
  description: string;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  { 
    name: 'Google AI Studio', 
    value: 'https://generativelanguage.googleapis.com/v1beta/openai',
    description: 'Google AI for Developers, requires a Google AI API key'
  },
  { 
    name: 'OpenRouter', 
    value: 'https://openrouter.ai/api/v1',
    description: 'Unified API platform with access to hundreds of models from multiple providers'
  },
  { 
    name: 'OpenAI', 
    value: 'https://api.openai.com/v1',
    description: 'Standard OpenAI API endpoint for GPT models'
  },
  { 
    name: 'Anthropic', 
    value: 'https://api.anthropic.com/v1',
    description: 'Anthropic Claude API endpoint for message-based interactions'
  },
  { 
    name: 'Mistral AI', 
    value: 'https://api.mistral.ai/v1',
    description: 'Mistral AI API for chat completions and embeddings'
  },
  { 
    name: 'Groq', 
    value: 'https://api.groq.com/openai/v1',
    description: 'Groq API with OpenAI-compatible interface for ultra-fast inference'
  },
  { 
    name: 'Custom', 
    value: 'custom',
    description: 'Use a custom API endpoint URL'
  }
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    keyRotationRequestCount: 5,
    maxFailureCount: 5,
    rateLimitCooldown: 60,
    logRetentionDays: 14,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    failoverDelay: 2,
    enableGoogleGrounding: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; details?: any } | null>(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [summaryStatsData, setSummaryStatsData] = useState<any>(null);
  const [summaryStatsLoading, setSummaryStatsLoading] = useState<boolean>(true);
  const [summaryStatsError, setSummaryStatsError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);

  const [summaryStats, setSummaryStats] = useState({
    totalRequests: 0,
    successRate: 0,
    totalRequestsToday: 0,
    activeKeys: 0
  });

  const [customEndpoint, setCustomEndpoint] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('https://generativelanguage.googleapis.com/v1beta/openai');

  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const matchingEndpoint = API_ENDPOINTS.find(ep => ep.value === settings.endpoint);
    if (matchingEndpoint) {
      setSelectedEndpoint(matchingEndpoint.value);
    } else {
      setSelectedEndpoint('custom');
      setCustomEndpoint(settings.endpoint);
    }
  }, [settings.endpoint]);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsSaved(false);

    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error(`Error fetching settings: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch settings';
      setError(errorMessage);
      console.error('Error fetching settings:', err);
      toast({
        title: 'Error Fetching Settings',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const formatPercentage = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return "N/A";
    }
    return `${value.toFixed(1)}%`;
  };

  const formatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return "N/A";
    }
    return value.toLocaleString();
  }

  const fetchSummaryStats = useCallback(async () => {
    setSummaryStatsLoading(true);
    setSummaryStatsError(null);
    try {
      const response = await fetch(`/api/stats?timeRange=${timeRange}`);
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error fetching summary statistics (${response.status}): ${errorData || response.statusText}`);
      }
      const data = await response.json();
      setSummaryStatsData(data);
      setSummaryStats({
        totalRequests: data?.totalRequests ?? 0,
        successRate: data?.successRate ?? 0,
        totalRequestsToday: data?.totalRequestsToday ?? 0,
        activeKeys: data?.activeKeys ?? 0,
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch summary statistics";
      setSummaryStatsError(errorMessage);
      console.error("Error fetching summary stats:", err);
    } finally {
      setSummaryStatsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchSettings();
    fetchSummaryStats();
  }, [fetchSettings, fetchSummaryStats]);

  useEffect(() => {
    fetchSummaryStats();
  }, [timeRange, fetchSummaryStats]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setIsSaved(false);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const data = await response.json();
      setSettings(data.settings);
      setIsSaved(true);

      toast({
        title: 'Settings Saved',
        description: 'Your settings have been updated successfully.',
      });

      // Auto-dismiss success alert after a delay
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save settings';
      setError(errorMessage);
      toast({
        title: 'Error Saving Settings',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof Settings, value: string | number | boolean) => {
    const numericFields: (keyof Settings)[] = [
      'keyRotationRequestCount',
      'maxFailureCount',
      'rateLimitCooldown',
      'logRetentionDays',
      'failoverDelay',
    ];
    
    // Handle different types of values
    let processedValue: string | number | boolean;
    if (typeof value === 'boolean') {
      processedValue = value; // Boolean values are used as-is
    } else if (numericFields.includes(field)) {
      processedValue = Number(value); // Convert to number for numeric fields
    } else {
      processedValue = value; // Use as-is for string fields
    }
    
    setSettings((prev) => ({ ...prev, [field]: processedValue }));
  };

  const handleCleanupLogs = useCallback(async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/cleanup-logs', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Log cleanup failed');
      }

      const successMessage = data.message || 'Log cleanup completed successfully.';
      setCleanupResult(successMessage);
      toast({
        title: 'Log Cleanup Successful',
        description: successMessage,
      });
    } catch (err: any) {
      const errorMessage = `Error: ${err.message}`;
      setCleanupResult(errorMessage);
      setError(`Cleanup Error: ${err.message}`);
      toast({
        title: 'Log Cleanup Failed',
        description: err.message || 'Could not delete old log files.',
        variant: 'destructive',
      });
    } finally {
      setIsCleaning(false);
    }
  }, [toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setImportResult(null);
    } else {
      setSelectedFile(null);
    }
  };

  const handleExportData = () => {
    window.location.href = '/api/admin/data/export';
  };

  const handleImportData = useCallback(async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a JSON file to import.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/admin/data/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Data import failed');
      }

      setImportResult({ message: data.message, details: data });
      toast({
        title: 'Data Import Complete',
        description: data.message || `Import finished. Keys: ${data.results?.keys}, Settings: ${data.results?.settings}, Logs: ${data.results?.logs}. Errors: ${data.results?.errors?.length || 0}`,
        variant: data.results?.errors?.length > 0 ? 'destructive' : 'default',
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to import data';
      setError(errorMessage);
      toast({
        title: 'Import Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }, [selectedFile, toast]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">Configure your load balancer behavior</p>
            </div>

            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => { fetchSummaryStats(); }} disabled={summaryStatsLoading}>
                    <RefreshCw className={cn("h-4 w-4", summaryStatsLoading && "animate-spin")} />
                    <span className="sr-only">Refresh stats</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh Stats</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {summaryStatsError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Error Fetching Summary Stats</AlertTitle>
              <AlertDescription>{summaryStatsError}</AlertDescription>
            </Alert>
          )}

          {!isClient ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure load balancer behavior</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {summaryStatsLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-1)/0.2)] to-transparent opacity-50 pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                      <BarChart3 className="w-5 h-5 text-[hsl(var(--chart-1))]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(summaryStats.totalRequests)}</div>
                      <p className="text-xs text-muted-foreground">Lifetime total</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-2)/0.2)] to-transparent opacity-50 pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">Today's Requests</CardTitle>
                      <BarChart3 className="w-5 h-5 text-[hsl(var(--chart-2))]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(summaryStats.totalRequestsToday)}</div>
                      <p className="text-xs text-muted-foreground">Since midnight</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-3)/0.2)] to-transparent opacity-50 pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                      <CheckCircle className="w-5 h-5 text-[hsl(var(--chart-3))]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatPercentage(summaryStats.successRate)}</div>
                      <p className="text-xs text-muted-foreground">In selected period</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-4)/0.2)] to-transparent opacity-50 pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
                      <Key className="w-5 h-5 text-[hsl(var(--chart-4))]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(summaryStats.activeKeys)}</div>
                      <p className="text-xs text-muted-foreground">Currently in rotation</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isSaved && (
                <Alert className="mb-4">
                  <CheckCircle className="w-4 h-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>Settings saved successfully.</AlertDescription>
                </Alert>
              )}

              <Card className="hover-animate">
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure load balancer behavior</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      <div className="grid gap-3">
                        <div className="grid items-center grid-cols-4 gap-4">
                          <Label htmlFor="keyRotationRequestCount" className="text-right">
                            Key Rotation Request Count
                          </Label>
                          <Input
                            id="keyRotationRequestCount"
                            type="number"
                            value={settings.keyRotationRequestCount}
                            onChange={(e) => handleInputChange('keyRotationRequestCount', e.target.value)}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid items-center grid-cols-4 gap-4">
                          <Label htmlFor="maxFailureCount" className="text-right">
                            Max Failure Count
                          </Label>
                          <Input
                            id="maxFailureCount"
                            type="number"
                            value={settings.maxFailureCount}
                            onChange={(e) => handleInputChange('maxFailureCount', e.target.value)}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid items-center grid-cols-4 gap-4">
                          <Label htmlFor="rateLimitCooldown" className="text-right">
                            Rate Limit Cooldown (seconds)
                          </Label>
                          <Input
                            id="rateLimitCooldown"
                            type="number"
                            value={settings.rateLimitCooldown}
                            onChange={(e) => handleInputChange('rateLimitCooldown', e.target.value)}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid items-center grid-cols-4 gap-4">
                          <Label htmlFor="logRetentionDays" className="text-right">
                            Log Retention Days
                          </Label>
                          <Input
                            id="logRetentionDays"
                            type="number"
                            value={settings.logRetentionDays}
                            onChange={(e) => handleInputChange('logRetentionDays', e.target.value)}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid items-center grid-cols-4 gap-4">
                          <Label htmlFor="failoverDelay" className="text-right">
                            Failover Delay (seconds)
                          </Label>
                          <Input
                            id="failoverDelay"
                            type="number"
                            min="0"
                            max="30"
                            value={settings.failoverDelay}
                            onChange={(e) =>
                              handleInputChange('failoverDelay', parseInt(e.target.value, 10))
                            }
                            className="col-span-3 bg-background/40 backdrop-blur-md transition-all duration-200"
                          />
                          <div className="col-span-4 pl-[25%] ml-4 -mt-1 text-xs text-muted-foreground space-y-1">
                            <p>Seconds to wait before switching to another API key after detecting rate limiting</p>
                            <p>Set to 0 for immediate failover, higher values help avoid rapid key switching</p>
                          </div>
                        </div>
                        <div className="grid items-center grid-cols-4 gap-4">
                          <Label htmlFor="endpoint" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-all duration-150 tracking-tight text-right">
                            API Endpoint
                          </Label>
                          <div className="col-span-3 space-y-2">
                            <Select
                              value={selectedEndpoint}
                              onValueChange={(value) => {
                                setSelectedEndpoint(value);
                                if (value !== 'custom') {
                                  handleInputChange('endpoint', value);
                                }
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select an endpoint" />
                              </SelectTrigger>
                              <SelectContent>
                                {API_ENDPOINTS.map((endpoint) => (
                                  <TooltipProvider key={endpoint.value}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="cursor-pointer">
                                          <SelectItem value={endpoint.value}>
                                            {endpoint.name}
                                          </SelectItem>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-md">
                                        <p>{endpoint.description}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedEndpoint === 'custom' && (
                              <Input
                                id="custom-endpoint"
                                type="text"
                                value={customEndpoint}
                                onChange={(e) => {
                                  setCustomEndpoint(e.target.value);
                                  handleInputChange('endpoint', e.target.value);
                                }}
                                placeholder="https://api.example.com/v1"
                                className="mt-2"
                              />
                            )}
                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              <p>Select a pre-configured endpoint or choose 'Custom' to enter your own</p>
                              {selectedEndpoint !== 'custom' && API_ENDPOINTS.find(e => e.value === selectedEndpoint)?.description && (
                                <p className="font-medium">{API_ENDPOINTS.find(e => e.value === selectedEndpoint)?.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Google Search Grounding toggle - only enabled for Google endpoint */}
                        {settings.endpoint.includes('generativelanguage.googleapis.com') && (
                          <div className="grid items-center grid-cols-4 gap-4">
                            <Label htmlFor="enableGoogleGrounding" className="text-right">
                              Google Search Grounding
                            </Label>
                            <div className="col-span-3 flex items-center space-x-2">
                              <Switch
                                id="enableGoogleGrounding"
                                checked={settings.enableGoogleGrounding}
                                onCheckedChange={(checked) => handleInputChange('enableGoogleGrounding', checked)}
                              />
                              <span>
                                {settings.enableGoogleGrounding ? 'Enabled' : 'Disabled'}
                              </span>
                              <div className="ml-6 text-xs text-muted-foreground">
                                <p>Uses Google Search to enhance responses with up-to-date information</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="theme-toggle">Dark Mode</Label>
                    <Switch id="theme-toggle" checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                  </div>
                  <Button onClick={handleSaveSettings} disabled={isLoading || isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Settings
                  </Button>
                </CardFooter>
              </Card>

              <Separator className="my-6" />

              <Card>
                <CardHeader>
                  <CardTitle>Database Operations</CardTitle>
                  <CardDescription>Manage your data</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Log Cleanup</CardTitle>
                      <CardDescription>Clear old log entries</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Delete logs older than {isLoading ? '...' : settings.logRetentionDays} days from the database.
                      </p>
                      {cleanupResult && (
                        <p className={cn("mt-2 text-sm", cleanupResult.includes("Error") ? "text-destructive" : "text-primary")}>
                          {cleanupResult}
                        </p>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button onClick={handleCleanupLogs} disabled={isCleaning} className="w-full">
                        {isCleaning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {isCleaning ? 'Cleaning...' : 'Clean Old Logs'}
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Data Backup</CardTitle>
                      <CardDescription>Export or import system data</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        variant="outline"
                        onClick={handleExportData}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export All Data
                      </Button>

                      <div className="space-y-2">
                        <Label htmlFor="import-file">Import Data (JSON)</Label>
                        <Input
                          id="import-file"
                          type="file"
                          accept=".json"
                          onChange={handleFileChange}
                          className="w-full"
                        />
                        {selectedFile && (
                          <p className="text-xs text-muted-foreground">Selected: {selectedFile.name}</p>
                        )}
                        {importResult && (
                          <p className={cn("text-sm", importResult.details?.results?.errors?.length > 0 ? "text-orange-500" : "text-primary")}>
                            {importResult.message}
                          </p>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        disabled={!selectedFile || isImporting}
                        onClick={handleImportData}
                        className="w-full"
                        variant="secondary"
                      >
                        {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {isImporting ? 'Importing...' : 'Import Data'}
                      </Button>
                    </CardFooter>
                  </Card>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}