"use client";

import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  RefreshCw,
  AlertTriangle,
  Info,
  Loader2,
  BarChart3,
  CheckCircle,
  Clock,
  Key
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

// --- Timezone Formatting Helper ---
const formatInTimeZone = (dateInput: string | Date | undefined | null, tz: string, fmt: string): string => {
  if (!dateInput) return 'Invalid Date';
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    if (isNaN(date.getTime())) { // Check if date is valid
        return 'Invalid Date';
    }
    const zonedDate = toZonedTime(date, tz);
    return format(zonedDate, fmt);
  } catch (e) {
    console.error("Error formatting date:", e, "Input:", dateInput);
    // Fallback to ISO string part or fixed text if formatting fails
    if (typeof dateInput === 'string') {
        // Basic check if it looks like an ISO string
        return dateInput.length > 10 ? dateInput.substring(0, 10) : 'Invalid Date';
    }
    return 'Invalid Date';
  }
};
// --- End Timezone Formatting Helper ---

// Interface for Pie Chart data entries
interface PieChartEntry {
  name: string;
  value: number;
  fill: string;
  isActive?: boolean; 
  opacity?: number;
}

// --- Chart Config --- (Using CSS variables defined in globals.css)
const chartConfig = {
  requests: {
    label: "Requests",
    color: "hsl(var(--chart-1))"
  },
  errors: {
    label: "Errors",
    color: "hsl(var(--chart-2))"
  },
  keyErrors: {
    label: "API Key Errors",
    color: "hsl(var(--chart-3))"
  },
  modelUsage: {
    label: "Models",
    color: "hsl(var(--chart-4))"
  },
  keyUsage: {
    label: "API Keys",
    color: "hsl(var(--chart-5))"
  },
};

// Colors for pie charts with enhanced visual appeal
const PIE_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(190, 80%, 50%)",
    "hsl(120, 70%, 50%)",
    "hsl(60, 80%, 60%)",
    "hsl(30, 90%, 60%)",
    "hsl(300, 70%, 60%)",
];
// --- End Chart Config ---

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [userTimeZone, setUserTimeZone] = useState<string>('UTC');
  const { toast } = useToast();

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stats?timeRange=${timeRange}`);
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error fetching statistics (${response.status}): ${errorData || response.statusText}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch statistics";
      setError(errorMessage);
      console.error("Error fetching stats:", err);
      toast({
        title: "Error Fetching Stats",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    fetchStats();
  }, [timeRange]);

  // Format percentage for display
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

  // --- Memoized Formatted Data ---
  const formattedRequestData = useMemo(() => {
    if (!stats?.requestData) return [];
    const formatString = timeRange === '24h' ? 'HH:mm' : 'MM-dd';
    return stats.requestData.map((item: any) => ({
      ...item,
      date: formatInTimeZone(item.name, userTimeZone, formatString),
      requests: item.requests ?? 0,
      errors: item.errors ?? 0,
      keyErrors: item.keyErrors ?? 0,
    }));
  }, [stats?.requestData, userTimeZone, timeRange]);

  const formattedHourlyData = useMemo(() => {
    if (!stats?.hourlyData) return [];
    // Ensure data is sorted by hour for correct chart display
    const sortedData = [...stats.hourlyData].sort((a, b) => {
        try {
            return parseISO(a.hour).getTime() - parseISO(b.hour).getTime();
        } catch {
            return 0; // Handle potential invalid date strings
        }
    });
    return sortedData.map((item: any) => ({
      ...item,
      hour: formatInTimeZone(item.hour, userTimeZone, 'HH:mm'),
      requests: item.requests ?? 0,
    }));
  }, [stats?.hourlyData, userTimeZone]);

  const keyUsageData = useMemo(() => {
    return stats?.keyUsageData?.map((item: any, index: number) => ({
        ...item,
        fill: PIE_COLORS[index % PIE_COLORS.length],
        opacity: item.isActive ? 1 : 0.5,
    })) || [];
  }, [stats?.keyUsageData]);

  const modelUsageData = useMemo(() => {
     return stats?.modelUsageData?.map((item: any, index: number) => ({
        ...item,
        fill: PIE_COLORS[index % PIE_COLORS.length],
     })) || [];
  }, [stats?.modelUsageData]);
  // --- End Memoized Formatted Data ---

  const renderLoading = () => (
      <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading statistics...</p>
      </div>
  );

  const renderError = () => (
       <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Error Fetching Statistics</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
       </Alert>
  );

  const renderNoData = () => (
       <Alert className="mb-6">
          <Info className="w-4 h-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No statistics found for the selected period. Try changing the time range or refreshing.
          </AlertDescription>
       </Alert>
  );

  return (
    <AppLayout>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage Statistics</h1>
          <p className="text-sm text-muted-foreground">Monitor your API usage</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={fetchStats} disabled={isLoading}>
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="sr-only">Refresh statistics</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh Statistics</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {error && renderError()}

      {isLoading ? renderLoading() : !stats ? renderNoData() : (
        <>
          {/* Stats Summary Cards */}
          <div className="grid gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
             <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-1)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                  <BarChart3 className="w-5 h-5 text-[hsl(var(--chart-1))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(stats.totalRequests)}</div>
                  <p className="text-xs text-muted-foreground">Lifetime total</p>
                </CardContent>
              </Card>
             <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-2)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <CheckCircle className="w-5 h-5 text-[hsl(var(--chart-2))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPercentage(stats.successRate)}</div>
                  <p className="text-xs text-muted-foreground">In selected period</p>
                </CardContent>
              </Card>
             <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-3)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                  <Clock className="w-5 h-5 text-[hsl(var(--chart-3))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgResponseTime !== null && stats.avgResponseTime !== undefined ? `${Math.round(stats.avgResponseTime)}ms` : 'N/A'}</div>
                  <p className="text-xs text-muted-foreground">Across successful requests</p>
                </CardContent>
              </Card>
             <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-4)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
                  <Key className="w-5 h-5 text-[hsl(var(--chart-4))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(stats.keyUsageData?.length || 0)}</div>
                  <p className="text-xs text-muted-foreground">Currently in rotation</p>
                </CardContent>
              </Card>
          </div>

          {/* Tabs for Charts */}
           <Tabs defaultValue="volume" className="mb-6">
            {/* Make TabsList full width and use grid for even distribution */}
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="volume">Request Volume</TabsTrigger>
              <TabsTrigger value="key-usage">Key Usage</TabsTrigger>
              <TabsTrigger value="model-usage">Model Usage</TabsTrigger>
              <TabsTrigger value="hourly">Hourly Breakdown</TabsTrigger>
            </TabsList>

            {/* Request Volume Tab */}
            <TabsContent value="volume" className="pt-4">
               <Card className="overflow-hidden border-0 shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-1)/0.05)] via-transparent to-[hsl(var(--chart-2)/0.05)] pointer-events-none" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Request Volume Over Time</span>
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-1))]"></div>
                  </CardTitle>
                  <CardDescription>Requests vs Errors ({timeRange})</CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="">
                    <ChartContainer config={chartConfig}>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart
                            data={formattedRequestData}
                            margin={{
                              top: 15,
                              right: 15,
                              left: 15,
                              bottom: 40,
                            }}
                          >
                            <defs>
                              <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                              </linearGradient>
                              <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
                              </linearGradient>
                              <linearGradient id="keyErrorsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              angle={-45}
                              textAnchor="end"
                              tickFormatter={(value) => value}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent />}
                            />
                            <ChartLegend 
                              verticalAlign="bottom"
                              height={48}
                              content={<ChartLegendContent />}
                            />
                            <Line
                              dataKey="requests"
                              type="monotone"
                              stroke={chartConfig.requests.color}
                              strokeWidth={3}
                              dot={{ r: 2, strokeWidth: 2, fill: "white" }}
                              activeDot={{ r: 6, strokeWidth: 0, fill: "hsl(var(--chart-1))" }}
                              fill="url(#requestsGradient)"
                              isAnimationActive={true}
                              animationDuration={1500}
                              animationEasing="ease-in-out"
                            />
                            <Line
                              dataKey="errors"
                              type="monotone"
                              stroke={chartConfig.errors.color}
                              strokeWidth={3}
                              dot={{ r: 2, strokeWidth: 2, fill: "white" }}
                              activeDot={{ r: 6, strokeWidth: 0, fill: "hsl(var(--chart-2))" }}
                              fill="url(#errorsGradient)"
                              isAnimationActive={true}
                              animationDuration={1500}
                              animationEasing="ease-in-out"
                              animationBegin={300}
                            />
                            <Line
                              dataKey="keyErrors"
                              type="monotone"
                              stroke={chartConfig.keyErrors.color}
                              strokeWidth={3}
                              dot={{ r: 2, strokeWidth: 2, fill: "white" }}
                              activeDot={{ r: 6, strokeWidth: 0, fill: "hsl(var(--chart-3))" }}
                              fill="url(#keyErrorsGradient)"
                              isAnimationActive={true}
                              animationDuration={1500}
                              animationEasing="ease-in-out"
                              animationBegin={600}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Key Usage Tab */}
            <TabsContent value="key-usage" className="pt-4">
              <Card className="overflow-hidden border-0 shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-5)/0.05)] via-transparent to-[hsl(var(--chart-3)/0.05)] pointer-events-none" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>API Key Usage Distribution</span>
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-5))]"></div>
                  </CardTitle>
                  <CardDescription>Distribution of requests across API keys ({timeRange})</CardDescription>
                </CardHeader>
                 <CardContent className="pb-4">
                   <div className="">
                     <ChartContainer config={chartConfig}>
                        <ResponsiveContainer width="100%" height={150}>
                          <PieChart>
                            <defs>
                              {keyUsageData.map((entry: PieChartEntry, index: number) => (
                                <filter key={`filter-${index}`} id={`glow-${index}`} height="200%" width="200%" x="-50%" y="-50%">
                                  <feGaussianBlur stdDeviation="3" result="blur" />
                                  <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="glow" />
                                  <feBlend in="SourceGraphic" in2="glow" mode="normal" />
                                </filter>
                              ))}
                            </defs>
                             <ChartTooltip
                                content={<ChartTooltipContent hideLabel />}
                             />
                             <Pie
                                data={keyUsageData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={30}
                                outerRadius={150}
                                paddingAngle={2}
                                label={({ name, percent }) =>
                                  `${name}: ${(percent * 100).toFixed(1)}%`
                                }
                                labelLine={true}
                                isAnimationActive={true}
                                animationDuration={1500}
                                animationEasing="ease-in-out"
                              >
                                {keyUsageData.map((entry: PieChartEntry, index: number) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.fill}
                                        opacity={entry.opacity}
                                        filter={`url(#glow-${index})`}
                                        className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    />
                                ))}
                             </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                     </ChartContainer>
                   </div>
                 </CardContent>
              </Card>
            </TabsContent>

            {/* Model Usage Tab */}
            <TabsContent value="model-usage" className="pt-4">
              <Card className="overflow-hidden border-0 shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-4)/0.05)] via-transparent to-[hsl(var(--chart-1)/0.05)] pointer-events-none" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Model Usage Distribution</span>
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-4))]"></div>
                  </CardTitle>
                  <CardDescription>Distribution of requests by model ({timeRange})</CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="">
                    <ChartContainer config={chartConfig}>
                       <ResponsiveContainer width="100%" height={150}>
                         <PieChart>
                           <ChartTooltip
                              content={<ChartTooltipContent hideLabel />}
                           />
                           <Pie
                              data={modelUsageData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={150}
                              paddingAngle={2}
                              label={({ name, percent }) =>
                                `${name}: ${(percent * 100).toFixed(1)}%`
                              }
                              labelLine={true}
                              isAnimationActive={true}
                              animationDuration={1500}
                              animationEasing="ease-in-out"
                            >
                              {modelUsageData.map((entry: PieChartEntry, index: number) => (
                                 <Cell
                                    key={`cell-${index}`}
                                    fill={entry.fill}
                                    className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                 />
                              ))}
                           </Pie>
                         </PieChart>
                       </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hourly Breakdown Tab */}
            <TabsContent value="hourly" className="pt-4">
              <Card className="overflow-hidden border-0 shadow-lg hover-animate">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-1)/0.05)] via-transparent to-[hsl(var(--chart-4)/0.05)] pointer-events-none" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Hourly Request Volume</span>
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-1))]"></div>
                  </CardTitle>
                  <CardDescription>Requests by hour (last 24 hours in {userTimeZone})</CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="">
                    <ChartContainer config={chartConfig}>
                       <ResponsiveContainer width="100%" height={150}>
                         <BarChart
                           data={formattedHourlyData}
                           margin={{
                             top: 15,
                             right: 15,
                             left: 15,
                             bottom: 40,
                           }}
                         >
                           <defs>
                             <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                               <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                             </linearGradient>
                           </defs>
                           <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                           <XAxis
                             dataKey="hour"
                             tickLine={false}
                             axisLine={false}
                             tickMargin={8}
                             angle={-45}
                             textAnchor="end"
                           />
                           <YAxis
                             tickLine={false}
                             axisLine={false}
                             tickMargin={8}
                           />
                           <ChartTooltip
                             cursor={{fill: 'rgba(0, 0, 0, 0.05)'}}
                             content={<ChartTooltipContent />}
                           />
                           <Bar
                             dataKey="requests"
                             fill="url(#hourlyGradient)"
                             radius={[4, 4, 0, 0]}
                             isAnimationActive={true}
                             animationDuration={1500}
                             animationEasing="ease-in-out"
                           />
                         </BarChart>
                       </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppLayout>
  );
}
