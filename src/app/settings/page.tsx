'use client';

import { useState, useEffect, useCallback } from 'react'; // Add useCallback
import {
  Box,
  // Grid, // Removed unused import
  // GridItem, // Removed unused import
  Heading,
  Text,
  FormControl,
  FormLabel,
  Input,
  Select,
  Switch,
  Button,
  useToast,
  Card,
  CardHeader,
  CardBody,
  Divider,
  Flex,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  IconButton,
  Tooltip,
  Spinner,
  SimpleGrid, // Import SimpleGrid
} from '@chakra-ui/react';
import { FiSave, FiRefreshCw, FiDownload, FiUpload } from 'react-icons/fi';
import AppLayout from '@/components/layout/AppLayout'; // Import AppLayout
import { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';

import { SettingsForm } from '@/components/settings/SettingsForm';
// Remove the AdminLayout import since it's not being used
// import { AdminLayout } from '@/components/layout/AdminLayout';
import { EndpointSetting } from '@/components/settings/EndpointSetting';

interface Settings {
  keyRotationRequestCount: number;
  maxFailureCount: number;
  rateLimitCooldown: number;
  logRetentionDays: number;
  endpoint: string; // Add endpoint field
  failoverDelay: number; // Delay before switching API on rate limited (0 for immediate)
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    keyRotationRequestCount: 5,
    maxFailureCount: 5,
    rateLimitCooldown: 60,
    logRetentionDays: 14,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', // Add default endpoint
    failoverDelay: 2, // Default 2 seconds delay before switching API on rate limited
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // State for import file
  const [isImporting, setIsImporting] = useState(false); // State for import button
  const [importResult, setImportResult] = useState<{ message: string; details?: any } | null>(null); // State for import result message

  const toast = useToast();
  const { colorMode, toggleColorMode } = useContext(ThemeContext);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error(`Error fetching settings: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch settings');
      console.error('Error fetching settings:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch settings',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
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
        title: 'Settings saved',
        description: 'Your settings have been updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
      toast({
        title: 'Error',
        description: err.message || 'Failed to save settings',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Function to trigger log cleanup
  const handleCleanupLogs = useCallback(async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    setError(null); // Clear previous general errors

    try {
      const response = await fetch('/api/admin/cleanup-logs', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Log cleanup failed');
      }

      setCleanupResult(data.message || 'Log cleanup completed successfully.');
      toast({
        title: 'Log Cleanup Successful',
        description: data.message || 'Old log files have been deleted.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

    } catch (err: any) {
      setCleanupResult(`Error: ${err.message}`);
      setError(`Cleanup Error: ${err.message}`); // Show error specifically
      toast({
        title: 'Log Cleanup Failed',
        description: err.message || 'Could not delete old log files.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsCleaning(false);
    }
  }, [toast]);

  // Handler for file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setImportResult(null); // Clear previous results
    } else {
      setSelectedFile(null);
    }
  };

  // Handler for triggering full data export
  const handleExportData = () => {
    // Simply navigate to the new data export endpoint
    window.location.href = '/api/admin/data/export';
  };

  // Handler for importing full data (OVERWRITES EXISTING DATA)
  const handleImportData = useCallback(async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a JSON file to import.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    setError(null); // Clear previous general errors

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/admin/data/import', {
        method: 'POST',
        body: formData, // Send as FormData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Data import failed');
      }

      setImportResult({ message: data.message, details: data }); // Store full result details
      toast({
        title: 'Data Import Complete',
        // Adjust description based on the new API response structure if needed
        description: data.message || `Import finished. Keys: ${data.results?.keys}, Settings: ${data.results?.settings}, Logs: ${data.results?.logs}. Errors: ${data.results?.errors?.length || 0}`,
        status: data.results?.errors?.length > 0 ? 'warning' : 'success',
        duration: 7000, // Longer duration to read details
        isClosable: true,
      });
      // Optionally refresh keys list if displayed on this page or redirect

    } catch (err: any) {
      setImportResult({ message: `Error: ${err.message}` });
      setError(`Import Error: ${err.message}`); // Show error specifically
      toast({
        title: 'Data Import Failed',
        description: err.message || 'Could not import data from file.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null); // Clear file input after attempt
      // Clear the actual file input element value
      const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }, [selectedFile, toast]);

  if (isLoading) {
    return (
      <AppLayout> {/* Use AppLayout for loading state */}
        {/* Removed Grid and Sidebar */}
        <Box p={6}> {/* Wrap content */}
          <Flex justify="center" align="center" h="80vh">
            <Spinner size="xl" color="blue.500" />
          </Flex>
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
            <Heading size="lg">Settings</Heading>
            <Text color="gray.500">Configure your Load Balancer</Text>
          </Box>
          <Tooltip label="Refresh Settings">
            <IconButton
              aria-label="Refresh settings"
              icon={<FiRefreshCw />}
              onClick={fetchSettings}
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

        {isSaved && (
          <Alert status="success" mb={6} borderRadius="md">
            <AlertIcon />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>Settings saved successfully</AlertDescription>
          </Alert>
        )}

        {/* Add the API Endpoint Configuration card here, before the SimpleGrid */}
        <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm" mb={6}>
          <CardHeader>
            <Heading size="md">API Endpoint Configuration</Heading>
          </CardHeader>
          <Divider borderColor={borderColor} />
          <CardBody>
            <EndpointSetting
              value={settings.endpoint || 'https://generativelanguage.googleapis.com/v1beta/openai'}
              onChange={(value) => setSettings({ ...settings, endpoint: value })}
            />
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6} mb={6}> {/* Adjusted grid columns and added margin */}
          <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
            <CardHeader>
              <Heading size="md">API Key Settings</Heading>
            </CardHeader>
            <Divider borderColor={borderColor} />
            <CardBody>
              <FormControl mb={4}>
                <FormLabel>Key Rotation Request Count</FormLabel>
                <NumberInput
                  value={settings.keyRotationRequestCount}
                  onChange={(_, value) => setSettings({ ...settings, keyRotationRequestCount: value })}
                  min={1}
                  max={100}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Number of requests before rotating to the next API key
                </Text>
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>Maximum Failure Count</FormLabel>
                <NumberInput
                  value={settings.maxFailureCount}
                  onChange={(_, value) => setSettings({ ...settings, maxFailureCount: value })}
                  min={1}
                  max={100}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Number of failures before deactivating an API key
                </Text>
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>Rate Limit Cooldown (seconds)</FormLabel>
                <NumberInput
                  value={settings.rateLimitCooldown}
                  onChange={(_, value) => setSettings({ ...settings, rateLimitCooldown: value })}
                  min={1}
                  max={3600}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Default cooldown period when rate limit is hit (if not specified by API)
                </Text>
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>Failover Delay (seconds)</FormLabel>
                <NumberInput
                  value={settings.failoverDelay}
                  onChange={(_, value) => setSettings({ ...settings, failoverDelay: value })}
                  min={0}
                  max={60}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Delay before switching API on rate limited (0 for immediate)
                </Text>
              </FormControl>
            </CardBody>
          </Card>

          <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
            <CardHeader>
              <Heading size="md">System Settings</Heading>
            </CardHeader>
            <Divider borderColor={borderColor} />
            <CardBody>
              <FormControl mb={4}>
                <FormLabel>Log Retention (days)</FormLabel>
                <NumberInput
                  value={settings.logRetentionDays}
                  onChange={(_, value) => setSettings({ ...settings, logRetentionDays: value })}
                  min={1}
                  max={90}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Number of days to keep request/error logs before manual cleanup
                </Text>
              </FormControl>

              <FormControl display="flex" alignItems="center" mb={4}>
                <FormLabel mb="0">Dark Mode</FormLabel>
                <Switch
                  isChecked={colorMode === 'dark'}
                  onChange={toggleColorMode}
                />
             </FormControl>

             {/* Add Cleanup Button */}
             <Flex direction="column" mt={4}>
               <Button
                 colorScheme="red"
                 variant="outline"
                 onClick={handleCleanupLogs}
                 isLoading={isCleaning}
                 loadingText="Cleaning..."
                 size="sm"
               >
                 Cleanup Logs Now
               </Button>
               {cleanupResult && (
                 <Text fontSize="sm" color={cleanupResult.startsWith('Error:') ? 'red.500' : 'green.500'} mt={2}>
                   {cleanupResult}
                 </Text>
               )}
                <Text fontSize="xs" color="gray.500" mt={1}>
                 Deletes log files older than the configured retention period.
               </Text>
             </Flex>

           </CardBody>
         </Card>
       </SimpleGrid>

       {/* Import/Export Card */}
       <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm" mb={6}>
         <CardHeader>
           <Heading size="md">Backup & Restore Data</Heading>
         </CardHeader>
         <Divider borderColor={borderColor} />
         <CardBody>
           <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
             {/* Export Section */}
             <Box>
               <Heading size="sm" mb={2}>Backup All Data</Heading>
               <Text fontSize="sm" color="gray.500" mb={3}>
                 Download a JSON file containing all API Keys, Settings, and Request Log history. Useful for backups or migration.
               </Text>
               <Button
                 leftIcon={<FiDownload />}
                 colorScheme="green"
                 variant="outline"
                 onClick={handleExportData}
               >
                 Backup All Data
               </Button>
             </Box>

             {/* Import Section */}
             <Box>
               <Heading size="sm" mb={2}>Restore Data from Backup</Heading>
               <Alert status="warning" mb={3} borderRadius="md" fontSize="sm">
                 <AlertIcon boxSize="16px" />
                 <Box>
                   <AlertTitle fontSize="sm">Warning!</AlertTitle>
                   <AlertDescription>Restoring will **overwrite** all current API Keys, Settings, and Request Logs with the content from the backup file.</AlertDescription>
                 </Box>
               </Alert>
               <Text fontSize="sm" color="gray.500" mb={3}>
                 Upload a previously exported JSON backup file.
               </Text>
               <FormControl>
                 <FormLabel htmlFor="import-file-input" srOnly>Select JSON file</FormLabel>
                 <Input
                   id="import-file-input"
                   type="file"
                   accept=".json"
                   onChange={handleFileChange}
                   mb={3}
                   size="sm"
                   variant="outline"
                   p={1} // Adjust padding for file input
                 />
                 <Button
                   leftIcon={<FiUpload />}
                   colorScheme="blue"
                   variant="outline"
                   onClick={handleImportData}
                   isLoading={isImporting}
                   loadingText="Restoring..."
                   isDisabled={!selectedFile || isImporting}
                   size="sm"
                 >
                   Restore from File
                 </Button>
               </FormControl>
               {importResult && (
                 <Box mt={3} p={3} borderWidth="1px" borderRadius="md" borderColor={importResult.message.startsWith('Error:') ? 'red.300' : 'green.300'} bg={importResult.message.startsWith('Error:') ? 'red.50' : 'green.50'}>
                   <Text fontSize="sm" fontWeight="bold" color={importResult.message.startsWith('Error:') ? 'red.600' : 'green.600'}>
                     {importResult.message}
                   </Text>
                   {importResult.details && (
                     <Text fontSize="xs" mt={1}>
                       Keys: {importResult.details?.results?.keys ?? 'N/A'},
                       Settings: {importResult.details?.results?.settings ?? 'N/A'},
                       Logs: {importResult.details?.results?.logs ?? 'N/A'},
                       Errors: {importResult.details?.results?.errors?.length ?? 0}
                       {importResult.details?.results?.errors?.length > 0 && (
                         <Tooltip label={importResult.details.results.errors.join('\n')} placement="top">
                           <Text as="span" ml={1} textDecoration="underline" cursor="help">(details)</Text>
                         </Tooltip>
                       )}
                     </Text>
                   )}
                 </Box>
               )}
             </Box>
           </SimpleGrid>
         </CardBody>
       </Card>

        <Flex justify="flex-end" mt={6}>
          <Button
            leftIcon={<FiSave />}
            colorScheme="blue"
            onClick={handleSaveSettings}
            isLoading={isSaving}
            loadingText="Saving..."
          >
            Save Settings
          </Button>
        </Flex>
      {/* Removed GridItem */}
    </AppLayout>
  );
}

// Remove this duplicate card that was causing the errors