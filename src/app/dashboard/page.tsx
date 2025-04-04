'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  Stat, 
  StatLabel, 
  StatNumber, 
  StatHelpText, 
  Card, 
  CardHeader, 
  CardBody,
  SimpleGrid,
  Icon,
  Flex,
  useColorModeValue,
  Tooltip,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast
} from '@chakra-ui/react';
import { FiKey, FiActivity, FiCpu, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import AppLayout from '@/components/layout/AppLayout';
import KeyStats from '@/components/keys/KeyStats';

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalKeys: 0,
    activeKeys: 0,
    totalRequests: 0, // Lifetime total from DB
    totalRequestsToday: 0, // Since midnight from DB
    totalRequests24h: 0, // Last 24h from logs
    errorRate: 0
  });

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const toast = useToast();

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch keys to get total and active counts
      const keysResponse = await fetch('/api/admin/keys');
      if (!keysResponse.ok) {
        throw new Error(`Error fetching keys: ${keysResponse.statusText}`);
      }
      const keysData = await keysResponse.json();
      
      // Fetch stats for request data
      const statsResponse = await fetch('/api/stats?timeRange=24h');
      if (!statsResponse.ok) {
        throw new Error(`Error fetching stats: ${statsResponse.statusText}`);
      }
      const statsData = await statsResponse.json();
      
      // Calculate stats
      const totalKeys = keysData.length;
      const activeKeys = keysData.filter((key: any) => key.isActive).length;
      const totalRequests = statsData.totalRequests || 0; // Lifetime
      const totalRequestsToday = statsData.totalRequestsToday || 0; // Since midnight
      const totalRequests24h = statsData.totalRequests24h || 0; // Last 24h from logs
      
      // Calculate error rate based on 24h requests if available, otherwise lifetime
      const relevantTotalRequestsForErrorRate = totalRequests24h > 0 ? totalRequests24h : totalRequests;
      const errorRate = relevantTotalRequestsForErrorRate > 0 && statsData.apiKeyErrors !== undefined
        ? ((statsData.apiKeyErrors / relevantTotalRequestsForErrorRate) * 100).toFixed(1)
        : 0;
      
      setStats({
        totalKeys,
        activeKeys,
        totalRequests, // Lifetime
        totalRequestsToday, // Since midnight
        totalRequests24h, // Last 24h
        errorRate: parseFloat(errorRate as string)
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message || 'Failed to fetch dashboard data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch dashboard data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <AppLayout>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg">Dashboard</Heading>
          <Text color="gray.500">Overview of your Load Balancer</Text>
        </Box>
        <Tooltip label="Refresh Dashboard">
          <IconButton
            aria-label="Refresh dashboard"
            icon={<FiRefreshCw />}
            onClick={fetchStats}
            isLoading={isLoading}
          />
        </Tooltip>
      </Flex>

      {error && (
        <Alert status="error" mb={6} borderRadius="md">
          <AlertIcon />
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 6 }} spacing={6} mb={8}> {/* Adjusted grid columns */}
        <Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
          <CardBody>
            <Flex align="center" mb={2}>
              <Icon as={FiKey} boxSize={6} color="blue.500" mr={2} />
              <Stat>
                <StatLabel>Total Keys</StatLabel>
                <StatNumber>{isLoading ? '-' : stats.totalKeys}</StatNumber>
                <StatHelpText>API Keys Configured</StatHelpText>
              </Stat>
            </Flex>
          </CardBody>
        </Card>

        <Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
          <CardBody>
            <Flex align="center" mb={2}>
              <Icon as={FiActivity} boxSize={6} color="green.500" mr={2} />
              <Stat>
                <StatLabel>Active Keys</StatLabel>
                <StatNumber>{isLoading ? '-' : stats.activeKeys}</StatNumber>
                <StatHelpText>Ready for Use</StatHelpText>
              </Stat>
            </Flex>
          </CardBody>
        </Card>
{/* New Card for Total Requests (Last 24 Hours) */}
<Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
  <CardBody>
    <Flex align="center" mb={2}>
      <Icon as={FiCpu} boxSize={6} color="cyan.500" mr={2} /> {/* Different color */}
      <Stat>
        <StatLabel>Total Requests (24h)</StatLabel>
        <StatNumber>{isLoading ? '-' : stats.totalRequests24h}</StatNumber>
        <StatHelpText>Last 24 Hours (Logs)</StatHelpText>
      </Stat>
    </Flex>
  </CardBody>
</Card>

        {/* New Card for Total Requests Today */}
        <Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
          <CardBody>
            <Flex align="center" mb={2}>
              <Icon as={FiCpu} boxSize={6} color="teal.500" mr={2} /> {/* Different color/icon? */}
              <Stat>
                <StatLabel>Total Requests (Today)</StatLabel>
                <StatNumber>{isLoading ? '-' : stats.totalRequestsToday}</StatNumber>
                <StatHelpText>Since Midnight (DB)</StatHelpText>
              </Stat>
            </Flex>
          </CardBody>
        </Card>
{/* Card for Total Requests (Lifetime) - Updated Label */}
<Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
  <CardBody>
    <Flex align="center" mb={2}>
      <Icon as={FiCpu} boxSize={6} color="purple.500" mr={2} />
      <Stat>
        <StatLabel>Total Requests (Lifetime)</StatLabel>
        <StatNumber>{isLoading ? '-' : stats.totalRequests}</StatNumber>
        <StatHelpText>All Time (DB)</StatHelpText>
      </Stat>
    </Flex>
  </CardBody>
</Card>

<Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
  <CardBody>
    <Flex align="center" mb={2}>
      <Icon as={FiAlertCircle} boxSize={6} color="orange.500" mr={2} />
      <Stat>
        <StatLabel>API Key Error Rate</StatLabel>
        <StatNumber>{isLoading ? '-' : `${stats.errorRate}%`}</StatNumber>
        <StatHelpText>Last 24 Hours (Logs)</StatHelpText>
      </Stat>
    </Flex>
  </CardBody>
</Card>
</SimpleGrid>

      <Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm" mb={8}>
        <CardHeader>
          <Heading size="md">Key Performance</Heading>
        </CardHeader>
        <CardBody>
          <KeyStats />
        </CardBody>
      </Card>
    </AppLayout>
  );
}