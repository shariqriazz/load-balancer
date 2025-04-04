'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  useToast,
  Flex,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import AppLayout from '@/components/layout/AppLayout';
import KeyStats from '@/components/keys/KeyStats';

interface ApiKey {
  _id: string;
  key: string;
  name?: string;
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
  const [newKeyDailyRateLimit, setNewKeyDailyRateLimit] = useState(''); // State for daily rate limit
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

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

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleAddKey = async () => {
    if (!newKey.trim()) {
      toast({
        title: 'Error',
        description: 'API key cannot be empty',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
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
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setNewKey('');
      setNewKeyName('');
      setNewKeyDailyRateLimit(''); // Reset daily rate limit state
      onClose();
      fetchKeys();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add API key',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <AppLayout>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg">API Keys</Heading>
          <Text color="gray.500">Manage your API keys</Text>
        </Box>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onOpen}>
          Add New Key
        </Button>
      </Flex>

      {error && (
        <Alert status="error" mb={6} borderRadius="md">
          <AlertIcon />
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Flex justify="center" align="center" h="200px">
          <Spinner size="xl" color="blue.500" />
        </Flex>
      ) : (
        <KeyStats />
      )}

      {/* Add Key Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New API Key</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired mb={4}> {/* Add margin bottom */}
              <FormLabel>API Key</FormLabel>
              <Input
                placeholder="Enter your API key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </FormControl>
            <FormControl> {/* Add name input */}
              <FormLabel>Key Name (Optional)</FormLabel>
              <Input
                placeholder="e.g., My Test Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </FormControl>
            <FormControl mt={4}> {/* Add Daily Rate Limit input */}
              <FormLabel>Daily Rate Limit (Optional)</FormLabel>
              <Input
                type="number" // Use number type for better input control
                placeholder="e.g., 100 (leave empty for no limit)"
                value={newKeyDailyRateLimit}
                onChange={(e) => setNewKeyDailyRateLimit(e.target.value)}
                min="0" // Prevent negative numbers
              />
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleAddKey}>
              Add Key
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AppLayout>
  );
}