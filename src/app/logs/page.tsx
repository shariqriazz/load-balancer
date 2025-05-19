"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Input as UiInput } from "@/components/ui/input";
import { Button as UiButton } from "@/components/ui/button";
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs as UiTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert as UiAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, RefreshCw, BarChart3, CheckCircle, Clock, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type LogType = "requests" | "errors" | "keys";

const LogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [logType, setLogType] = useState<LogType>("keys");
  const [loading, setLoading] = useState<boolean>(false);
  const [requestLogsTriggered, setRequestLogsTriggered] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(100);
  const [search, setSearch] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>(""); // Debounced search term
  const [timeRange, setTimeRange] = useState("24h");
  const [summaryStatsData, setSummaryStatsData] = useState<any>(null);
  const [summaryStatsLoading, setSummaryStatsLoading] = useState<boolean>(true);
  const [summaryStatsError, setSummaryStatsError] = useState<string | null>(null);
  const { toast } = useToast();
  const [appErrorStats, setAppErrorStats] = useState<{ totalErrors: number, apiKeyErrors: number } | null>(null);
  const [appErrorStatsLoading, setAppErrorStatsLoading] = useState<boolean>(true);
  const [appErrorStatsError, setAppErrorStatsError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);

  const [summaryStats, setSummaryStats] = useState({
    totalRequests: 0,
    totalRequestsToday: 0,
    successRate: 0,
    activeKeys: 0
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: logType,
        limit: limit.toString(),
      });
      if (searchTerm) {
        params.append("search", searchTerm);
      }
      const response = await fetch(`/api/logs?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error("Failed to fetch logs:", err);
      const errorMessage = err.message || "Failed to fetch logs.";
      setError(errorMessage);
      setLogs([]);
      toast({
        title: "Error fetching logs",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [logType, limit, searchTerm, toast]);

  useEffect(() => {
    if (isClient && logType === "keys") {
      fetchLogs();
    }
  }, [isClient, logType, fetchLogs]);

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
        totalRequestsToday: data?.totalRequestsToday ?? 0,
        successRate: data?.successRate ?? 0,
        activeKeys: data?.activeKeys ?? 0,
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch summary statistics";
      setSummaryStatsError(errorMessage);
      console.error("Error fetching summary stats:", err);
      toast({
        title: "Error Fetching Summary Stats",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSummaryStatsLoading(false);
    }
  }, [timeRange, toast]);

  const fetchAppErrorStats = useCallback(async () => {
    setAppErrorStatsLoading(true);
    setAppErrorStatsError(null);
    try {
      const response = await fetch(`/api/stats?timeRange=24h`);
      if (!response.ok) {
        throw new Error(`Error fetching stats: ${response.statusText}`);
      }
      const data = await response.json();
      setAppErrorStats({
        totalErrors: data.totalErrors ?? 0,
        apiKeyErrors: data.apiKeyErrors ?? 0,
      });
    } catch (err: any) {
      console.error("Failed to fetch app error stats:", err);
      const errorMessage = err.message || "Failed to fetch error summary.";
      setAppErrorStatsError(errorMessage);
      toast({
        title: "Error fetching error summary",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAppErrorStatsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isClient) {
      fetchSummaryStats();
    }
  }, [isClient, timeRange, fetchSummaryStats]);

  useEffect(() => {
    if (isClient) {
      fetchAppErrorStats();
    }
  }, [isClient, fetchAppErrorStats]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(search);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && (logType !== 'requests' || requestLogsTriggered)) {
      fetchLogs();
    }
  }, [searchTerm, limit, isClient, logType, requestLogsTriggered, fetchLogs]);

  const handleTabChange = (value: string) => {
    const newType = value as LogType;
    setLogType(newType);
  };

  const handleSearch = () => {
    setSearchTerm(search);
  };

  const handleLoadRequests = () => {
    setRequestLogsTriggered(true);
  };

  const otherApplicationErrors = useMemo(() => {
    if (!appErrorStats) return 0;
    return Math.max(0, appErrorStats.totalErrors - appErrorStats.apiKeyErrors);
  }, [appErrorStats]);

  const renderLogs = (currentLogType: LogType) => {
    if (loading) {
      return <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }
    if (error) {
      return (
        <UiAlert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </UiAlert>
      );
    }
    return (
      <div className="bg-muted/50 p-4 rounded-md max-h-[70vh] overflow-y-auto border">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <pre
              key={`${currentLogType}-${index}`}
              className="block p-2 mb-2 overflow-x-auto text-sm whitespace-pre-wrap border rounded-sm bg-background text-foreground"
            >
              {JSON.stringify(log, null, 2)}
            </pre>
          ))
        ) : (
          <p className="py-4 text-center text-muted-foreground">No {currentLogType} logs found matching criteria.</p>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="flex flex-col space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Application Logs</h1>
              <p className="text-sm text-muted-foreground">View and search system logs</p>
            </div>

            <div className="flex items-center gap-2">
              <UiSelect value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </UiSelect>
              <Tooltip>
                <TooltipTrigger asChild>
                  <UiButton variant="outline" size="icon" onClick={() => { fetchSummaryStats(); fetchAppErrorStats(); }} disabled={summaryStatsLoading || appErrorStatsLoading}>
                    <RefreshCw className={cn("h-4 w-4", (summaryStatsLoading || appErrorStatsLoading) && "animate-spin")} />
                    <span className="sr-only">Refresh logs and stats</span>
                  </UiButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh Stats</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {summaryStatsError && (
            <UiAlert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Error Fetching Summary Stats</AlertTitle>
              <AlertDescription>{summaryStatsError}</AlertDescription>
            </UiAlert>
          )}

          {!isClient ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="hover-animate"><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                <Card className="hover-animate"><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                <Card className="hover-animate"><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                <Card className="hover-animate"><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
              </div>
              <Card className="h-[100px] hover-animate"><CardHeader><CardTitle>Other Application Errors</CardTitle></CardHeader><CardContent><Loader2 className="w-6 h-6 animate-spin text-primary" /></CardContent></Card>
              <div className="h-10"></div>
              <div className="flex items-center justify-center h-64 border rounded-md"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            </div>
          ) : (
            <>
              {summaryStatsLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="hover-animate"><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card className="hover-animate"><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card className="hover-animate"><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card className="hover-animate"><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
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

              <Card className="border-0 shadow-lg hover-animate">
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-red-500/5 via-transparent to-orange-500/5" />
                <CardHeader>
                  <CardTitle className="text-lg">Other Application Errors (Last 24h)</CardTitle>
                  <CardDescription>Total errors excluding API key failures</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {appErrorStatsLoading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : appErrorStatsError ? 'Error' : otherApplicationErrors}
                  </div>
                  {appErrorStatsError && <p className="text-sm text-destructive">{appErrorStatsError}</p>}
                </CardContent>
              </Card>

              <div className="flex flex-col pt-4 space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4">
                <UiInput
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-grow"
                />
                <UiSelect value={limit.toString()} onValueChange={(value) => setLimit(Number(value))}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </UiSelect>
                <UiButton onClick={handleSearch} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Search
                </UiButton>
              </div>

              <UiTabs defaultValue="keys" onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="requests">Requests</TabsTrigger>
                  <TabsTrigger value="errors">Errors</TabsTrigger>
                  <TabsTrigger value="keys">Keys</TabsTrigger>
                </TabsList>
                <TabsContent value="requests" className="mt-4">
                  {!requestLogsTriggered ? (
                    <div className="flex flex-col items-center justify-center h-48 space-y-4 border rounded-md">
                      <p className="text-muted-foreground">Request logs can be large.</p>
                      <UiButton
                        onClick={handleLoadRequests}
                        disabled={loading && logType === 'requests'}
                      >
                        {loading && logType === 'requests' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Load Request Logs
                      </UiButton>
                    </div>
                  ) : (
                    renderLogs("requests")
                  )}
                </TabsContent>
                <TabsContent value="errors" className="mt-4">
                  {renderLogs("errors")}
                </TabsContent>
                <TabsContent value="keys" className="mt-4">
                  {renderLogs("keys")}
                </TabsContent>
              </UiTabs>
            </>
          )}
        </div>
      </TooltipProvider>
    </AppLayout>
  );
};

export default LogsPage;
