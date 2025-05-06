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
  Select,
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
  profile?: string | null; // Profile name for key grouping
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
  const [newKeyProfile, setNewKeyProfile] = useState(''); // State for profile
  const [newKeyDailyRateLimit, setNewKeyDailyRateLimit] = useState(''); // State for daily rate limit
  const [existingProfiles, setExistingProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const { isOpen, onOpen: originalOnOpen, onClose: originalOnClose } = useDisclosure();

  // Custom onOpen handler to reset form state
  const onOpen = () => {
    setNewKey('');
    setNewKeyName('');
    setNewKeyDailyRateLimit('');
    setSelectedProfile('');
    setIsCreatingNewProfile(false);
    setNewProfileName('');
    originalOnOpen();
  };

  // Custom onClose handler
  const onClose = () => {
    originalOnClose();
  };
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

  // Extract unique profiles from keys
  const extractProfiles = (keys: ApiKey[]): string[] => {
    const profileSet = new Set<string>();

    keys.forEach(key => {
      if (key.profile && key.profile.trim() !== '') {
        profileSet.add(key.profile.trim());
      }
    });

    return Array.from(profileSet).sort();
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // Update existing profiles whenever keys change
  useEffect(() => {
    const profiles = extractProfiles(keys);
    setExistingProfiles(profiles);
  }, [keys]);

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

    // Determine which profile to use
    let profileToUse = '';

    if (isCreatingNewProfile) {
      if (!newProfileName.trim()) {
        toast({
          title: 'Error',
          description: 'Profile name cannot be empty when creating a new profile',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      profileToUse = newProfileName.trim();
    } else {
      profileToUse = selectedProfile;
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
          profile: profileToUse, // Use the determined profile
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

      // Reset all form fields
      setNewKey('');
      setNewKeyName('');
      setNewKeyDailyRateLimit(''); // Reset daily rate limit state
      setSelectedProfile('');
      setIsCreatingNewProfile(false);
      setNewProfileName('');
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
            {/* Step 1: Profile Selection */}
            <FormControl isRequired mb={4}>
              <FormLabel>Profile</FormLabel>
              <Select
                placeholder="Select a profile"
                value={isCreatingNewProfile ? "new" : selectedProfile}
                onChange={(e) => {
                  if (e.target.value === "new") {
                    setIsCreatingNewProfile(true);
                    setSelectedProfile("");
                  } else {
                    setIsCreatingNewProfile(false);
                    setSelectedProfile(e.target.value);
                  }
                }}
              >
                {existingProfiles.map(profile => (
                  <option key={profile} value={profile}>{profile}</option>
                ))}
                <option value="new">+ Create New Profile</option>
              </Select>
            </FormControl>

            {/* Show input for new profile name if creating new profile */}
            {isCreatingNewProfile && (
              <FormControl isRequired mb={4}>
                <FormLabel>New Profile Name</FormLabel>
                <Input
                  placeholder="e.g., Google, OpenAI, Anthropic"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                />
              </FormControl>
            )}

            {/* Only show the rest of the form if a profile is selected or creating new profile */}
            {(selectedProfile || isCreatingNewProfile) && (
              <>
                <FormControl isRequired mb={4}>
                  <FormLabel>API Key</FormLabel>
                  <Input
                    placeholder="Enter your API key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </FormControl>

                <FormControl mb={4}>
                  <FormLabel>Key Name (Optional)</FormLabel>
                  <Input
                    placeholder="e.g., My Test Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Daily Rate Limit (Optional)</FormLabel>
                  <Input
                    type="number"
                    placeholder="e.g., 100 (leave empty for no limit)"
                    value={newKeyDailyRateLimit}
                    onChange={(e) => setNewKeyDailyRateLimit(e.target.value)}
                    min="0"
                  />
                </FormControl>
              </>
            )}
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleAddKey}
              isDisabled={!(selectedProfile || (isCreatingNewProfile && newProfileName.trim()))}
            >
              Add Key
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AppLayout>
  );
}