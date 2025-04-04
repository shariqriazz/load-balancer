"use client"; // Add this because Chakra UI components might need it

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  // Grid, // Removed unused import
  // GridItem, // Removed unused import
  Box,
  Heading,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  Alert,
  AlertIcon,
  Code,
  VStack,
  HStack,
  Input,
  Button,
  Select,
  useToast,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  SimpleGrid, // Or Flex if preferred
} from "@chakra-ui/react";
import AppLayout from "@/components/layout/AppLayout";

type LogType = "requests" | "errors" | "keys";

const LogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [logType, setLogType] = useState<LogType>("keys"); // Default to 'keys'
  const [loading, setLoading] = useState<boolean>(false);
  const [requestLogsTriggered, setRequestLogsTriggered] = useState<boolean>(false); // State for request logs load
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(100);
  const [search, setSearch] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>(""); // Debounced search term
  const toast = useToast();
  const [appErrorStats, setAppErrorStats] = useState<{ totalErrors: number, apiKeyErrors: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false); // State to track client-side mount

  // Define colors for light/dark mode
  const logBoxBg = useColorModeValue("gray.50", "gray.700");
  const codeBg = useColorModeValue("white", "gray.800");
  const codeColor = useColorModeValue("gray.800", "gray.100");
  const cardBg = useColorModeValue("white", "gray.800"); // For the new card
  const borderColor = useColorModeValue("gray.200", "gray.700"); // For the new card

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
      // Add startDate and endDate params here if date pickers were implemented

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
      setError(err.message || "Failed to fetch logs.");
      setLogs([]);
      toast({
        title: "Error fetching logs",
        description: err.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [logType, limit, searchTerm, toast]); // Add dependencies

  // Fetch initial logs for the default tab ('keys')
  useEffect(() => {
    fetchLogs();
  }, []); // Run only once on mount

  // Remove the useEffect that depended on [fetchLogs]
  // useEffect(() => {
  //   fetchLogs();
  // }, [fetchLogs]);

  // Fetch aggregate stats for error summary
  const fetchAppErrorStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const response = await fetch(`/api/stats?timeRange=24h`); // Fetch 24h stats
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
      setStatsError(err.message || "Failed to fetch error summary.");
      toast({
        title: "Error fetching error summary",
        description: err.message || "An unexpected error occurred.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAppErrorStats();
  }, [fetchAppErrorStats]);

  // Basic debounce for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(search);
    }, 500); // Adjust delay as needed

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Set isClient to true after mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleTabChange = (index: number) => {
    const types: LogType[] = ["requests", "errors", "keys"];
    const newType = types[index];
    setLogType(newType);
    // Only fetch automatically for errors and keys tabs
    if (newType === "errors" || newType === "keys") {
      fetchLogs();
    }
    // If switching to requests, reset the trigger *if* you want it to require button press every time
    // if (newType === 'requests') {
    //   setRequestLogsTriggered(false); // Optional: uncomment to force button press on each visit
    // }
  };

  const handleSearch = () => {
    setSearchTerm(search); // Trigger search immediately on button click
    // fetchLogs(); // fetchLogs is already triggered by searchTerm change via useEffect
  };

  // Calculate other application errors
  const otherApplicationErrors = useMemo(() => {
    if (!appErrorStats) return 0;
    return Math.max(0, appErrorStats.totalErrors - appErrorStats.apiKeyErrors);
  }, [appErrorStats]);

  return (
    <AppLayout>
        <VStack align="stretch" spacing={6}> {/* Increased spacing */}
          <Heading size="lg">Application Logs</Heading>

          {/* Add Error Summary Card */}
          <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
            <CardBody>
              <Stat>
                <StatLabel>Other Application Errors (Last 24h)</StatLabel>
                <StatNumber>
                  {!isClient ? 0 : statsLoading ? <Spinner size="sm" /> : statsError ? 'Error' : otherApplicationErrors}
                </StatNumber>
                <StatHelpText>Total errors excluding API key failures</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <HStack spacing={4}>
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
            <Select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              width="150px"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </Select>
            <Button onClick={handleSearch} isLoading={loading}>
              Search
            </Button>
            {/* Add Date Pickers here if needed */}
          </HStack>

          <Tabs
            onChange={handleTabChange}
            variant="soft-rounded"
            colorScheme="blue"
            defaultIndex={2} // Set default tab to 'Keys' (index 2)
          >
            <TabList>
              <Tab>Requests</Tab>
              <Tab>Errors</Tab>
              <Tab>Keys</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                {/* Request Logs Tab Content - Only render conditional UI on client */}
                {!isClient ? (
                  <Spinner /> // Render a simple spinner during SSR/initial hydration
                ) : !requestLogsTriggered ? (
                  <VStack spacing={4} align="center" justify="center" h="200px">
                    <Text>Request logs can be large.</Text>
                    <Button
                      onClick={() => {
                        setRequestLogsTriggered(true);
                        fetchLogs(); // Fetch logs when button is clicked
                      }}
                      isLoading={loading && logType === 'requests'} // Show loading on button if fetching requests
                      colorScheme="blue"
                    >
                      Load Request Logs
                    </Button>
                  </VStack>
                ) : (
                  <>
                    {/* Existing loading/error/log display logic */}
                    {loading && <Spinner />}
                    {error && (
                      <Alert status="error">
                        <AlertIcon />
                        {error}
                      </Alert>
                    )}
                    {!loading && !error && (
                      <Box
                        bg={logBoxBg}
                        p={4}
                        borderRadius="md"
                        maxHeight="70vh"
                        overflowY="auto"
                      >
                        {logs.length > 0 ? (
                          logs.map((log, index) => (
                            <Code
                              display="block"
                              whiteSpace="pre-wrap"
                              key={index}
                              p={2}
                              mb={2}
                              borderRadius="sm"
                              bg={codeBg}
                              color={codeColor}
                            >
                              {JSON.stringify(log, null, 2)}
                            </Code>
                          ))
                        ) : (
                          <Text>No request logs found matching criteria.</Text>
                        )}
                      </Box>
                    )}
                  </>
                )}
              </TabPanel>
              <TabPanel>
                {loading && <Spinner />}
                {error && (
                  <Alert status="error">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}
                {!loading && !error && (
                  <Box
                    bg={logBoxBg}
                    p={4}
                    borderRadius="md"
                    maxHeight="70vh"
                    overflowY="auto"
                  >
                    {logs.length > 0 ? (
                      logs.map((log, index) => (
                        <Code
                          display="block"
                          whiteSpace="pre-wrap"
                          key={index}
                          p={2}
                          mb={2}
                          borderRadius="sm"
                          bg={codeBg}
                          color={codeColor}
                        >
                          {JSON.stringify(log, null, 2)}
                        </Code>
                      ))
                    ) : (
                      <Text>No error logs found matching criteria.</Text>
                    )}
                  </Box>
                )}
              </TabPanel>
              <TabPanel>
                {loading && <Spinner />}
                {error && (
                  <Alert status="error">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}
                {!loading && !error && (
                  <Box
                    bg={logBoxBg}
                    p={4}
                    borderRadius="md"
                    maxHeight="70vh"
                    overflowY="auto"
                  >
                    {logs.length > 0 ? (
                      logs.map((log, index) => (
                        <Code
                          display="block"
                          whiteSpace="pre-wrap"
                          key={index}
                          p={2}
                          mb={2}
                          borderRadius="sm"
                          bg={codeBg}
                          color={codeColor}
                        >
                          {JSON.stringify(log, null, 2)}
                        </Code>
                      ))
                    ) : (
                      <Text>No key logs found matching criteria.</Text>
                    )}
                  </Box>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
    </AppLayout>
  );
};

export default LogsPage;
