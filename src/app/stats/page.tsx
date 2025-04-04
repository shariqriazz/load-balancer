"use client";

import { useState, useEffect } from "react";
import {
  Box,
  // Grid, // Removed unused import
  // GridItem, // Removed unused import
  Heading,
  Text,
  Flex,
  Select,
  FormControl,
  FormLabel,
  Card,
  CardHeader,
  CardBody,
  Divider,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  useToast,
  Button,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
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
import { FiRefreshCw } from "react-icons/fi";
import AppLayout from "@/components/layout/AppLayout"; // Import AppLayout

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const lineColor = useColorModeValue("#3182CE", "#63B3ED");
  const errorColor = useColorModeValue("#E53E3E", "#FC8181");
  const toast = useToast();
  const axisTickColor = useColorModeValue("gray.700", "#FFFFFF"); // Explicit white for dark mode
 
  // Colors for pie charts
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
  ];

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stats?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error(`Error fetching statistics: ${response.statusText}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch statistics");
      console.error("Error fetching stats:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to fetch statistics",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  // Handle case when stats is null
  if (!isLoading && !error && !stats) {
    return (
      <AppLayout> {/* Use AppLayout for no-data state */}
        {/* Removed Grid and Sidebar */}
        <Box p={6}> {/* Wrap content in a Box or Fragment if needed */}
          <Alert status="info">
            <AlertIcon />
            <AlertTitle>No Data</AlertTitle>
            <AlertDescription>
              No statistics data is available yet. Make some API requests to
              generate statistics.
            </AlertDescription>
          </Alert>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout> {/* Use AppLayout for main content */}
      {/* Removed Grid and Sidebar */}
      {/* Main content starts here */}
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Heading size="lg">Usage Statistics</Heading>
            <Text color="gray.500">Monitor your API usage</Text>
          </Box>

          <Flex gap={2} align="center">
            <FormControl w="200px">
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </Select>
            </FormControl>
            <Tooltip label="Refresh Statistics">
              <IconButton
                aria-label="Refresh statistics"
                icon={<FiRefreshCw />}
                onClick={fetchStats}
                isLoading={isLoading}
              />
            </Tooltip>
          </Flex>
        </Flex>

        {error && (
          <Alert status="error" mb={6} borderRadius="md">
            <AlertIcon />
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <Flex justify="center" align="center" h="400px">
            <Spinner size="xl" color="blue.500" />
          </Flex>
        ) : stats ? (
          <>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={6}>
              <Card
                bg={cardBg}
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="lg"
                shadow="sm"
              >
                <CardBody>
                  <Stat>
                    <StatLabel>Total Requests</StatLabel>
                    <StatNumber>
                      {stats.totalRequests.toLocaleString()}
                    </StatNumber>
                    <StatHelpText>In selected period</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card
                bg={cardBg}
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="lg"
                shadow="sm"
              >
                <CardBody>
                  <Stat>
                    <StatLabel>Error Rate</StatLabel>
                    <StatNumber>
                      {stats.totalRequests > 0 && stats.apiKeyErrors !== undefined
                        ? ((stats.apiKeyErrors / stats.totalRequests) * 100).toFixed(1)
                        : '0.0'}%
                    </StatNumber>
                    <StatHelpText>{stats.apiKeyErrors ?? 0} API key errors</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card
                bg={cardBg}
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="lg"
                shadow="sm"
              >
                <CardBody>
                  <Stat>
                    <StatLabel>Avg Response Time</StatLabel>
                    <StatNumber>{stats.avgResponseTime}ms</StatNumber>
                    <StatHelpText>Across all requests</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card
                bg={cardBg}
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="lg"
                shadow="sm"
              >
                <CardBody>
                  <Stat>
                    <StatLabel>Active Keys</StatLabel>
                    <StatNumber>{stats.keyUsageData?.length || 0}</StatNumber>
                    <StatHelpText>Currently in rotation</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>

            <Tabs variant="enclosed" mb={6}>
              <TabList>
                <Tab>Request Volume</Tab>
                <Tab>Key Usage</Tab>
                <Tab>Model Usage</Tab>
              </TabList>

              <TabPanels>
                <TabPanel p={0} pt={4}>
                  {/* --- Request Volume Over Time (Line Chart) --- */}
                  <Card
                    bg={cardBg}
                    borderWidth="1px"
                    borderColor={borderColor}
                    borderRadius="lg"
                    shadow="sm"
                    mb={6} // Add margin bottom
                  >
                    <CardHeader>
                      <Heading size="md">Request Volume Over Time</Heading>
                      <Text fontSize="sm" color="gray.500">Total requests and API key errors based on selected time range.</Text>
                    </CardHeader>
                    <Divider borderColor={borderColor} />
                    <CardBody>
                      {stats.requestData && stats.requestData.length > 0 ? (
                        <Box h="400px">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={stats.requestData}
                              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={borderColor} />
                             {/* XAxis uses 'timestamp' for 24h (UTC ISO string) and 'name' otherwise */}
                             <XAxis
                              dataKey={timeRange === '24h' ? 'timestamp' : 'name'}
                              stroke={useColorModeValue("gray.600", "gray.400")}
                              tick={{ fill: axisTickColor, fontSize: 12 }}
                              tickFormatter={(value) => {
                                // If 24h range, format the ISO timestamp to local HH:00
                                if (timeRange === '24h') {
                                  try {
                                    const date = new Date(value);
                                    if (!isNaN(date.getTime())) {
                                      // Format to local time HH:00
                                      return date.toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false // Use 24-hour format
                                      });
                                    }
                                  } catch (e) { /* ignore format errors */ }
                                  return value; // Fallback to raw value on error
                                }
                                // Otherwise (7d, 30d, 90d), the value is already the formatted name
                                return value;
                              }}
                              // Optional: Adjust interval for 24h if labels overlap
                              // interval={timeRange === '24h' ? 'preserveStartEnd' : undefined}
                             />
                             <YAxis stroke={useColorModeValue("gray.600", "gray.400")} tick={{ fill: axisTickColor, fontSize: 12 }}/>
                             <RechartsTooltip
                               contentStyle={{
                                 backgroundColor: cardBg,
                                 borderColor: borderColor,
                               }}
                               labelFormatter={(label) => {
                                 // Format the label in the tooltip based on range
                                 if (timeRange === '24h') {
                                   try {
                                     const date = new Date(label); // Label is the timestamp ISO string
                                     if (!isNaN(date.getTime())) {
                                       // Show full local date and time in tooltip
                                       return date.toLocaleString('en-US', {
                                         dateStyle: 'short', // e.g., 4/1/25
                                         timeStyle: 'short', // e.g., 13:00
                                         hour12: false,
                                       });
                                     }
                                   } catch (e) {}
                                   return label; // Fallback
                                 }
                                 // For other ranges, label is already formatted name (e.g., "Mon 1", "Apr 1")
                                 return label;
                               }}
                             />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="requests"
                                stroke={lineColor}
                                strokeWidth={2}
                                activeDot={{ r: 6 }}
                                name="Total Requests"
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="apiKeyErrors"
                                stroke={errorColor}
                                strokeWidth={2}
                                activeDot={{ r: 6 }}
                                name="API Key Errors"
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <Flex justify="center" align="center" h="200px">
                          <Text color="gray.500">
                            No request data available for this period.
                          </Text>
                        </Flex>
                      )}
                    </CardBody>
                  </Card>

                  {/* --- Hourly Request Distribution (Bar Chart - Primarily for 24h view) --- */}
                  <Card
                    bg={cardBg}
                    borderWidth="1px"
                    borderColor={borderColor}
                    borderRadius="lg"
                    shadow="sm"
                  >
                    <CardHeader>
                      <Heading size="md">Hourly Request Distribution (Last 24h)</Heading>
                       <Text fontSize="sm" color="gray.500">Requests per hour over the last 24 hours.</Text>
                    </CardHeader>
                    <Divider borderColor={borderColor} />
                    <CardBody>
                      {stats.hourlyData && stats.hourlyData.length > 0 ? (
                        <Box h="300px">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={stats.hourlyData}
                              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={borderColor} />
                              <XAxis
                                dataKey="hour" // The raw ISO string from backend
                                stroke={useColorModeValue("gray.600", "gray.400")}
                                tick={{ fill: axisTickColor, fontSize: 12 }} // Use defined axisTickColor
                                tickFormatter={(isoString) => {
                                  // Format the ISO string for display
                                  try {
                                    const date = new Date(isoString);
                                    if (!isNaN(date.getTime())) {
                                      // Format as "MMM DD HH:00" e.g., "Mar 29 09:00"
                                      return date.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false, // Use 24-hour format
                                      });
                                    }
                                  } catch (e) { /* ignore */ }
                                  return isoString; // Fallback
                                }}
                                // Optional: Adjust interval if too many labels overlap
                                // interval="preserveStartEnd" // or a number like 2 or 3
                              />
                              <YAxis stroke={useColorModeValue("gray.600", "gray.400")} tick={{ fill: axisTickColor, fontSize: 12 }}/>
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: cardBg,
                                  borderColor: borderColor,
                                }}
                                labelFormatter={(label) => {
                                   // Format the label in the tooltip as well
                                   try {
                                    const date = new Date(label);
                                     if (!isNaN(date.getTime())) {
                                       return date.toLocaleString('en-US', {
                                         dateStyle: 'medium',
                                         timeStyle: 'short',
                                         hour12: false,
                                       });
                                     }
                                   } catch(e) {}
                                   return label;
                                }}
                              />
                              <Legend />
                              <Bar
                                dataKey="requests"
                                fill={lineColor}
                                name="Requests"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <Flex justify="center" align="center" h="200px">
                          <Text color="gray.500">
                            No hourly data available.
                          </Text>
                        </Flex>
                      )}
                    </CardBody>
                  </Card>
                </TabPanel>

                <TabPanel p={0} pt={4}>
                  <Card
                    bg={cardBg}
                    borderWidth="1px"
                    borderColor={borderColor}
                    borderRadius="lg"
                    shadow="sm"
                  >
                    <CardHeader>
                      <Heading size="md">API Key Usage Distribution</Heading>
                    </CardHeader>
                    <Divider borderColor={borderColor} />
                    <CardBody>
                      {stats.keyUsageData?.length > 0 ? (
                        <Box h="400px">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats.keyUsageData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                label={({ name, percent }) =>
                                  `${name}: ${(percent * 100).toFixed(0)}%`
                                }
                                outerRadius={150}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {stats.keyUsageData.map(
                                  (entry: any, index: number) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={COLORS[index % COLORS.length]}
                                    />
                                  )
                                )}
                              </Pie>
                              <RechartsTooltip
                                formatter={(value: number, name: string, entry: any) => [`${value} requests (${(entry.payload.percent * 100).toFixed(1)}%)`, name]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <Flex justify="center" align="center" h="200px">
                          <Text color="gray.500">
                            No key usage data available
                          </Text>
                        </Flex>
                      )}
                    </CardBody>
                  </Card>
                </TabPanel>

                <TabPanel p={0} pt={4}>
                  <Card
                    bg={cardBg}
                    borderWidth="1px"
                    borderColor={borderColor}
                    borderRadius="lg"
                    shadow="sm"
                  >
                    <CardHeader>
                      <Heading size="md">Model Usage Distribution</Heading>
                    </CardHeader>
                    <Divider borderColor={borderColor} />
                    <CardBody>
                      {stats.modelUsageData?.length > 0 ? (
                        <Box h="400px">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats.modelUsageData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                label={({ name, percent }) =>
                                  `${name}: ${(percent * 100).toFixed(0)}%`
                                }
                                outerRadius={150}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {stats.modelUsageData.map(
                                  (entry: any, index: number) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={COLORS[index % COLORS.length]}
                                    />
                                  )
                                )}
                              </Pie>
                              <RechartsTooltip
                                formatter={(value: any) => `${value}%`}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <Flex justify="center" align="center" h="200px">
                          <Text color="gray.500">
                            No model usage data available
                          </Text>
                        </Flex>
                      )}
                    </CardBody>
                  </Card>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </>
        ) : null}
      {/* Removed GridItem */}
    </AppLayout>
  );
}
