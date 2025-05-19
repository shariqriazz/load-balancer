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
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    keyRotationRequestCount: 5,
    maxFailureCount: 5,
    rateLimitCooldown: 60,
    logRetentionDays: 14,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    failoverDelay: 2,
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

  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [summaryStats, setSummaryStats] = useState({
    totalRequests: 0,
    successRate: 0,
    totalRequestsToday: 0,
    activeKeys: 0
  });

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

  const handleInputChange = (field: keyof Settings, value: string | number) => {
    const numericFields: (keyof Settings)[] = [
      'keyRotationRequestCount',
      'maxFailureCount',
      'rateLimitCooldown',
      'logRetentionDays',
      'failoverDelay',
    ];
    const processedValue = numericFields.includes(field) ? Number(value) : value;
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
                            value={settings.failoverDelay}
                            onChange={(e) => handleInputChange('failoverDelay', e.target.value)}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid items-center grid-cols-4 gap-4">
                          <Label htmlFor="endpoint" className="text-right">
                            API Endpoint
                          </Label>
                          <Input
                            id="endpoint"
                            type="text"
                            value={settings.endpoint}
                            onChange={(e) => handleInputChange('endpoint', e.target.value)}
                            className="col-span-3"
                          />
                        </div>
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