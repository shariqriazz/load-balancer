'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Skeleton,
  Text,
  useColorModeValue,
  Flex,
  Button,
  IconButton,
  Tooltip,
  HStack,
  VStack,
  Heading,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Switch,
  // Add NumberInput components
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  // Add Checkbox
  Checkbox,
  // Add Tabs components
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { FiRefreshCw, FiTrash2, FiEdit2, FiSettings, FiAlertTriangle } from 'react-icons/fi'; // Add FiEdit2, FiSettings, FiAlertTriangle
import { useRef, useMemo } from 'react'; // Add useMemo
// Import modal components for editing
import {
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
} from '@chakra-ui/react';

interface ApiKey {
  _id: string;
  key: string;
  name?: string;
  profile?: string | null; // Profile name for key grouping
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null; // Global rate limit reset time
  failureCount: number;
  requestCount: number; // Total requests
  // New fields for daily rate limiting
  dailyRateLimit?: number | null;
  dailyRequestsUsed: number;
  lastResetDate: string | null; // We might not display this, but it's good to have
  isDisabledByRateLimit: boolean;
}

export default function KeyStats() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<{[key: string]: boolean}>({});
  // Removed dailyRequests state as it's now part of the ApiKey object
  // State for Delete confirmation
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRefDelete = useRef<HTMLButtonElement>(null); // Rename ref for clarity
  const toast = useToast();
  // State for Rate Limit Override confirmation
  const { isOpen: isWarnOpen, onOpen: onWarnOpen, onClose: onWarnClose } = useDisclosure();
  const cancelRefWarn = useRef<HTMLButtonElement>(null); // Separate ref for warning dialog
  const [keyToToggle, setKeyToToggle] = useState<string | null>(null); // Store key ID for warning confirmation

  // State for Edit modal
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editProfileValue, setEditProfileValue] = useState(''); // State for profile
  const [editRateLimitValue, setEditRateLimitValue] = useState<string>(''); // Store as string for input flexibility
  const [isSavingChanges, setIsSavingChanges] = useState(false); // Renamed state

  // State for bulk selection
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set());

  // State for Bulk Limit Modal
  const { isOpen: isBulkLimitOpen, onOpen: onBulkLimitOpen, onClose: onBulkLimitClose } = useDisclosure();
  const [bulkLimitValue, setBulkLimitValue] = useState<string>('');
  const [isApplyingBulkLimit, setIsApplyingBulkLimit] = useState(false);

  // State for Bulk Delete Modal
  const { isOpen: isBulkDeleteOpen, onOpen: onBulkDeleteOpen, onClose: onBulkDeleteClose } = useDisclosure();
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const cancelRefBulkDelete = useRef<HTMLButtonElement>(null);
  const tableBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Removed getCurrentDate as fetchDailyRequests is removed

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/keys');
      if (!response.ok) {
        throw new Error(`Error fetching keys: ${response.statusText}`);
      }
      const data = await response.json();
      setKeys(data);
    } catch (error) {
      console.error('Error fetching keys:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch API keys',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Removed fetchDailyRequests function

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

  // Group keys by profile
  const groupKeysByProfile = (keys: ApiKey[]): { [profile: string]: ApiKey[] } => {
    const grouped: { [profile: string]: ApiKey[] } = {
      'Default': [] // Always include a Default group
    };

    keys.forEach(key => {
      const profile = key.profile && key.profile.trim() !== '' ? key.profile.trim() : 'Default';
      if (!grouped[profile]) {
        grouped[profile] = [];
      }
      grouped[profile].push(key);
    });

    return grouped;
  };

  // Get existing profiles
  const existingProfiles = useMemo(() => extractProfiles(keys), [keys]);

  // Get keys grouped by profile
  const keysByProfile = useMemo(() => groupKeysByProfile(keys), [keys]);

  // Fetch keys on mount
  useEffect(() => {
    fetchKeys();
  }, []);

  // Removed useEffect hook for fetchDailyRequests

  // Refresh keys data
  const refreshData = () => {
    fetchKeys();
  };

  // Function to get status badge
  const getStatusBadge = (key: ApiKey) => {
    // Order of checks matters: Disabled > Daily Limited > Globally Limited > Active
    if (!key.isActive) {
      return <Badge colorScheme="gray">Disabled</Badge>;
    }
    if (key.isDisabledByRateLimit) {
      return <Badge colorScheme="orange">Daily Limited</Badge>; // New status
    }
    if (key.rateLimitResetAt && new Date(key.rateLimitResetAt) > new Date()) {
      return <Badge colorScheme="yellow">Rate Limited</Badge>; // Global limit
    }
    return <Badge colorScheme="green">Active</Badge>;
  };

  // Function to format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Function to delete a key
  const handleDeleteKey = async () => {
    if (!selectedKeyId) return;

    try {
      const response = await fetch(`/api/admin/keys/${selectedKeyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete key');
      }

      toast({
        title: 'Success',
        description: 'API key deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Refresh the keys list
      fetchKeys();
    } catch (error) {
      console.error('Error deleting key:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      onDeleteClose();
      setSelectedKeyId(null); // Clear selected key ID after closing
    }
  };

  // Extracted API call logic for toggling
  const proceedWithToggle = async (keyId: string) => {
    setIsToggling(prev => ({ ...prev, [keyId]: true }));
    let success = false;
    try {
      const response = await fetch(`/api/admin/keys/${keyId}`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to update key status');
      }

      const data = await response.json();
      success = true; // Mark as success before potential fetchKeys error

      toast({
        title: 'Success',
        description: `API key status updated successfully.`, // Simplified message
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Refresh the keys list
      fetchKeys();

    } catch (error) {
      console.error('Error toggling key status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update API key status',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsToggling(prev => ({ ...prev, [keyId]: false }));
      onWarnClose(); // Close warning dialog if open
      setKeyToToggle(null); // Clear the key ID
    }
  };

  // Function to handle the toggle action, potentially showing a warning
  const handleToggleKey = (keyId: string, currentStatus: boolean, isDisabledByRateLimit: boolean) => {
    // Check if we are trying to ENABLE a key that was DISABLED BY RATE LIMIT
    if (!currentStatus && isDisabledByRateLimit) {
      setKeyToToggle(keyId); // Store the key ID we want to toggle
      onWarnOpen(); // Open the warning dialog
    } else {
      // Otherwise, proceed directly with the toggle
      proceedWithToggle(keyId);
    }
  };

  // Function to handle opening the edit modal
  const handleOpenEditModal = (key: ApiKey) => {
    setEditingKey(key);
    setEditNameValue(key.name || '');
    setEditProfileValue(key.profile || '');
    // Pre-fill rate limit, handle null/undefined by setting to empty string for the input
    setEditRateLimitValue(key.dailyRateLimit?.toString() ?? '');
    onEditOpen();
  };

  // Function to save the edited changes (name and rate limit)
  const handleSaveChanges = async () => {
    if (!editingKey) return;
    setIsSavingChanges(true);

    // --- Input Validation ---
    let rateLimitToSend: number | null = null;
    if (editRateLimitValue.trim() === '') {
      rateLimitToSend = null; // Empty input means no limit
    } else {
      const parsedLimit = parseInt(editRateLimitValue, 10);
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        toast({
          title: 'Invalid Input',
          description: 'Daily Rate Limit must be a non-negative number or empty.',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        setIsSavingChanges(false);
        return; // Stop execution
      }
      rateLimitToSend = parsedLimit;
    }
    // --- End Validation ---

    try {
      const bodyToSend = {
        name: editNameValue.trim() || undefined, // Send undefined if name is empty after trimming
        profile: editProfileValue.trim() || null, // Send null if profile is empty after trimming
        dailyRateLimit: rateLimitToSend,
      };

      const response = await fetch(`/api/admin/keys/${editingKey._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update key');
      }

      toast({
        title: 'Success',
        description: 'API key updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onEditClose();
      fetchKeys(); // Refresh list

    } catch (error: any) {
      console.error('Error updating key:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update API key',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSavingChanges(false);
    }
  };

// --- Bulk Action Handlers ---

const handleSelectKey = (keyId: string, isSelected: boolean) => {
  setSelectedKeyIds(prev => {
    const newSet = new Set(prev);
    if (isSelected) {
      newSet.add(keyId);
    } else {
      newSet.delete(keyId);
    }
    return newSet;
  });
};

const handleSelectAll = (isSelected: boolean) => {
  if (isSelected) {
    setSelectedKeyIds(new Set(keys.map(key => key._id)));
  } else {
    setSelectedKeyIds(new Set());
  }
};

// Memoize values for "select all" checkbox state
const isAllSelected = useMemo(() => keys.length > 0 && selectedKeyIds.size === keys.length, [selectedKeyIds, keys]);
const isIndeterminate = useMemo(() => selectedKeyIds.size > 0 && selectedKeyIds.size < keys.length, [selectedKeyIds, keys]);

const handleApplyBulkLimit = async () => {
    if (selectedKeyIds.size === 0) return;
    setIsApplyingBulkLimit(true);

    // --- Input Validation ---
    let rateLimitToSend: number | null = null;
    if (bulkLimitValue.trim() === '') {
        rateLimitToSend = null; // Empty means no limit
    } else {
        const parsedLimit = parseInt(bulkLimitValue, 10);
        if (isNaN(parsedLimit) || parsedLimit < 0) {
            toast({
                title: 'Invalid Input',
                description: 'Daily Rate Limit must be a non-negative number or empty.',
                status: 'error',
                duration: 4000,
                isClosable: true,
            });
            setIsApplyingBulkLimit(false);
            return;
        }
        rateLimitToSend = parsedLimit;
    }
    // --- End Validation ---

    try {
        const response = await fetch('/api/admin/keys/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'setLimit',
                keyIds: Array.from(selectedKeyIds),
                dailyRequestLimit: rateLimitToSend,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to apply bulk limit');
        }

        toast({
            title: 'Success',
            description: result.message || `Successfully updated limit for ${result.updatedCount} keys.`,
            status: 'success',
            duration: 3000,
            isClosable: true,
        });

        onBulkLimitClose();
        setSelectedKeyIds(new Set()); // Clear selection
        setBulkLimitValue(''); // Reset modal input
        fetchKeys(); // Refresh list

    } catch (error: any) {
        console.error('Error applying bulk limit:', error);
        toast({
            title: 'Error',
            description: error.message || 'Failed to apply bulk limit',
            status: 'error',
            duration: 5000,
            isClosable: true,
        });
    } finally {
        setIsApplyingBulkLimit(false);
    }
};

const handleBulkDelete = async () => {
    if (selectedKeyIds.size === 0) return;
    setIsDeletingBulk(true);

    try {
        const response = await fetch('/api/admin/keys/bulk', {
            method: 'PATCH', // Still using PATCH as defined in the backend route
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete', // Specify the delete action
                keyIds: Array.from(selectedKeyIds),
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to bulk delete keys');
        }

        toast({
            title: 'Success',
            description: result.message || `Successfully deleted ${result.count} keys.`,
            status: 'success',
            duration: 3000,
            isClosable: true,
        });

        onBulkDeleteClose();
        setSelectedKeyIds(new Set()); // Clear selection
        fetchKeys(); // Refresh list

    } catch (error: any) {
        console.error('Error bulk deleting keys:', error);
        toast({
            title: 'Error',
            description: error.message || 'Failed to bulk delete keys',
            status: 'error',
            duration: 5000,
            isClosable: true,
        });
    } finally {
        setIsDeletingBulk(false);
    }
};


// --- End Bulk Action Handlers ---


// Reusable KeyTable component
const KeyTable = ({
  profileKeys,
  isLoading,
  selectedKeyIds,
  handleSelectKey,
  getStatusBadge,
  formatDate,
  isToggling,
  handleToggleKey,
  handleOpenEditModal,
  setSelectedKeyId,
  onDeleteOpen,
  setSelectedKeyIds
}: {
  profileKeys: ApiKey[],
  isLoading: boolean,
  selectedKeyIds: Set<string>,
  handleSelectKey: (keyId: string, isSelected: boolean) => void,
  getStatusBadge: (key: ApiKey) => JSX.Element,
  formatDate: (dateString: string | null) => string,
  isToggling: {[key: string]: boolean},
  handleToggleKey: (keyId: string, currentStatus: boolean, isDisabledByRateLimit: boolean) => void,
  handleOpenEditModal: (key: ApiKey) => void,
  setSelectedKeyId: (id: string | null) => void,
  onDeleteOpen: () => void,
  setSelectedKeyIds: (ids: Set<string>) => void
}) => {
  const tableBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Calculate if all keys in this profile are selected
  const isAllProfileSelected = profileKeys.length > 0 &&
    profileKeys.every(key => selectedKeyIds.has(key._id));

  // Calculate if some keys in this profile are selected
  const isProfileIndeterminate = profileKeys.some(key => selectedKeyIds.has(key._id)) &&
    !isAllProfileSelected;

  // Handle select all for this profile
  const handleSelectAllProfile = (isSelected: boolean) => {
    const newSelectedIds = new Set(selectedKeyIds);

    profileKeys.forEach(key => {
      if (isSelected) {
        newSelectedIds.add(key._id);
      } else {
        newSelectedIds.delete(key._id);
      }
    });

    // Update the parent's selectedKeyIds state
    setSelectedKeyIds(newSelectedIds);
  };

  return (
    <Box overflowX="auto">
      <Table variant="simple" size="sm" bg={tableBg} borderWidth="1px" borderColor={borderColor} borderRadius="md">
        <Thead>
          <Tr>
            <Th paddingRight={2}>
              <Checkbox
                isChecked={isAllProfileSelected}
                isIndeterminate={isProfileIndeterminate}
                onChange={(e) => handleSelectAllProfile(e.target.checked)}
                isDisabled={profileKeys.length === 0}
              />
            </Th>
            <Th>Name</Th>
            <Th>API Key</Th>
            <Th>Status</Th>
            <Th>Last Used</Th>
            <Th>Daily Usage / Limit</Th>
            <Th>Requests (Total)</Th>
            <Th>Failures</Th>
            <Th>Enabled</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {/* Conditional Rendering Logic */}
          {isLoading
            ? /* Skeleton Loading State */
              Array.from({ length: 2 }).map((_, index) => (
                <Tr key={`skeleton-${index}`}>
                  <Td paddingRight={2}><Checkbox isDisabled /></Td>
                  <Td><Skeleton height="20px" width="100px" /></Td>
                  <Td><Skeleton height="20px" /></Td>
                  <Td><Skeleton height="20px" width="80px" /></Td>
                  <Td><Skeleton height="20px" width="150px" /></Td>
                  <Td><Skeleton height="20px" width="100px" /></Td>
                  <Td><Skeleton height="20px" width="60px" /></Td>
                  <Td><Skeleton height="20px" width="60px" /></Td>
                  <Td><Skeleton height="20px" width="60px" /></Td>
                  <Td><Skeleton height="20px" width="100px" /></Td>
                </Tr>
              ))
            : profileKeys.length === 0
            ? /* No Keys State */
              <Tr>
                <Td colSpan={10} textAlign="center" py={4}>
                  No API keys found in this profile.
                </Td>
              </Tr>
            : /* Keys Available State */
              profileKeys.map((key) => (
                <Tr key={key._id}>
                  <Td paddingRight={2}>
                    <Checkbox
                      isChecked={selectedKeyIds.has(key._id)}
                      onChange={(e) => handleSelectKey(key._id, e.target.checked)}
                    />
                  </Td>
                  <Td>{key.name || <Text as="i" color="gray.500">N/A</Text>}</Td>
                  <Td fontFamily="mono">{`${key.key.substring(0, 10)}...${key.key.substring(key.key.length - 4)}`}</Td>
                  <Td>{getStatusBadge(key)}</Td>
                  <Td>{formatDate(key.lastUsed)}</Td>
                  <Td>{key.dailyRequestsUsed} / {(key.dailyRateLimit === null || key.dailyRateLimit === undefined) ? '∞' : key.dailyRateLimit}</Td>
                  <Td>{key.requestCount}</Td>
                  <Td>{key.failureCount}</Td>
                  <Td><Switch isChecked={key.isActive} isDisabled={isToggling[key._id]} onChange={() => handleToggleKey(key._id, key.isActive, key.isDisabledByRateLimit)} size="sm" /></Td>
                  <Td>
                    <HStack spacing={2}>
                      <Tooltip label="Edit Name & Limit">
                        <IconButton aria-label="Edit key name and limit" icon={<FiEdit2 />} size="sm" variant="ghost" colorScheme="blue" onClick={() => handleOpenEditModal(key)} />
                      </Tooltip>
                      <Tooltip label="Delete Key">
                        <IconButton aria-label="Delete key" icon={<FiTrash2 />} size="sm" variant="ghost" colorScheme="red" onClick={() => { setSelectedKeyId(key._id); onDeleteOpen(); }} />
                      </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))
          }
          {/* End of Conditional Rendering */}
        </Tbody>
      </Table>
    </Box>
  );
};

return (
  <Box>
    <Flex justify="space-between" align="center" mb={4}>
      {/* Left side: Selection count and bulk actions */}
      <HStack spacing={4}>
         {selectedKeyIds.size > 0 && (
           <>
             <Text fontSize="sm" fontWeight="medium">
               {selectedKeyIds.size} selected
             </Text>
             <Tooltip label="Set Daily Limit for Selected Keys">
               <Button
                 size="sm"
                 leftIcon={<FiSettings />}
                 colorScheme="teal"
                 variant="outline"
                 onClick={onBulkLimitOpen} // Open the bulk limit modal
               >
                 Set Limit
               </Button>
             </Tooltip>
             <Tooltip label="Delete Selected Keys">
               <Button
                 size="sm"
                 leftIcon={<FiTrash2 />}
                 colorScheme="red"
                 variant="outline"
                 onClick={onBulkDeleteOpen} // Open the bulk delete confirmation
               >
                 Delete ({selectedKeyIds.size})
               </Button>
             </Tooltip>
           </>
         )}
      </HStack>

      {/* Right side: Total count and refresh */}
      <HStack spacing={4}>
         <Text fontSize="sm" color="gray.500">
           Total: {keys.length} keys
         </Text>
         <Button
           size="sm"
           leftIcon={<FiRefreshCw />}
           onClick={refreshData}
           isLoading={isLoading}
         >
           Refresh
         </Button>
      </HStack>
    </Flex>

    {/* Profile-based Tabs */}
    <Tabs variant="soft-rounded" colorScheme="blue" isLazy>
      <TabList mb={4} overflowX="auto" flexWrap="nowrap" css={{ scrollbarWidth: 'thin' }}>
        {/* All Profiles tab */}
        <Tab>All Profiles</Tab>

        {/* Always show Default tab */}
        <Tab>Default ({keysByProfile['Default']?.length || 0})</Tab>

        {/* Show tabs for each profile */}
        {Object.keys(keysByProfile)
          .filter(profile => profile !== 'Default')
          .map(profile => (
            <Tab key={profile}>{profile} ({keysByProfile[profile]?.length || 0})</Tab>
          ))
        }
      </TabList>

      <TabPanels>
        {/* All Profiles tab panel */}
        <TabPanel p={0}>
          <VStack spacing={8} align="stretch">
            {/* Default profile first */}
            <Box
              p={4}
              borderWidth="1px"
              borderRadius="lg"
              borderColor={useColorModeValue('gray.200', 'gray.700')}
              bg={useColorModeValue('white', 'gray.800')}
            >
              <Flex justify="space-between" align="center" mb={4}>
                <Heading size="md">Default Profile ({keysByProfile['Default']?.length || 0})</Heading>
                {!isLoading && keysByProfile['Default']?.length === 0 && (
                  <Text color="gray.500" fontSize="sm">No keys in this profile</Text>
                )}
              </Flex>
              <KeyTable
                profileKeys={keysByProfile['Default'] || []}
                isLoading={isLoading}
                selectedKeyIds={selectedKeyIds}
                handleSelectKey={handleSelectKey}
                getStatusBadge={getStatusBadge}
                formatDate={formatDate}
                isToggling={isToggling}
                handleToggleKey={handleToggleKey}
                handleOpenEditModal={handleOpenEditModal}
                setSelectedKeyId={setSelectedKeyId}
                onDeleteOpen={onDeleteOpen}
                setSelectedKeyIds={setSelectedKeyIds}
              />
            </Box>

            {/* All other profiles */}
            {Object.keys(keysByProfile)
              .filter(profile => profile !== 'Default')
              .map(profile => (
                <Box
                  key={profile}
                  p={4}
                  borderWidth="1px"
                  borderRadius="lg"
                  borderColor={useColorModeValue('gray.200', 'gray.700')}
                  bg={useColorModeValue('white', 'gray.800')}
                >
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">{profile} Profile ({keysByProfile[profile]?.length || 0})</Heading>
                    {!isLoading && keysByProfile[profile]?.length === 0 && (
                      <Text color="gray.500" fontSize="sm">No keys in this profile</Text>
                    )}
                  </Flex>
                  <KeyTable
                    profileKeys={keysByProfile[profile] || []}
                    isLoading={isLoading}
                    selectedKeyIds={selectedKeyIds}
                    handleSelectKey={handleSelectKey}
                    getStatusBadge={getStatusBadge}
                    formatDate={formatDate}
                    isToggling={isToggling}
                    handleToggleKey={handleToggleKey}
                    handleOpenEditModal={handleOpenEditModal}
                    setSelectedKeyId={setSelectedKeyId}
                    onDeleteOpen={onDeleteOpen}
                    setSelectedKeyIds={setSelectedKeyIds}
                  />
                </Box>
              ))
            }
          </VStack>
        </TabPanel>

        {/* Default profile tab */}
        <TabPanel p={0}>
          <KeyTable
            profileKeys={keysByProfile['Default'] || []}
            isLoading={isLoading}
            selectedKeyIds={selectedKeyIds}
            handleSelectKey={handleSelectKey}
            getStatusBadge={getStatusBadge}
            formatDate={formatDate}
            isToggling={isToggling}
            handleToggleKey={handleToggleKey}
            handleOpenEditModal={handleOpenEditModal}
            setSelectedKeyId={setSelectedKeyId}
            onDeleteOpen={onDeleteOpen}
            setSelectedKeyIds={setSelectedKeyIds}
          />
        </TabPanel>

        {/* Tabs for each profile */}
        {Object.keys(keysByProfile)
          .filter(profile => profile !== 'Default')
          .map(profile => (
            <TabPanel key={profile} p={0}>
              <KeyTable
                profileKeys={keysByProfile[profile] || []}
                isLoading={isLoading}
                selectedKeyIds={selectedKeyIds}
                handleSelectKey={handleSelectKey}
                getStatusBadge={getStatusBadge}
                formatDate={formatDate}
                isToggling={isToggling}
                handleToggleKey={handleToggleKey}
                handleOpenEditModal={handleOpenEditModal}
                setSelectedKeyId={setSelectedKeyId}
                onDeleteOpen={onDeleteOpen}
                setSelectedKeyIds={setSelectedKeyIds}
              />
            </TabPanel>
          ))
        }
      </TabPanels>
    </Tabs>

      {/* Delete Confirmation Dialog */}
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRefDelete}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete API Key
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this API key? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRefDelete} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteKey} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Edit Name Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit API Key</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Key Name</FormLabel>
              <Input
                placeholder="Enter a name for this key"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Optional name to help identify the key.
              </Text>
            </FormControl>

            {/* Profile Input */}
            <FormControl mt={4}>
              <FormLabel>Profile</FormLabel>
              <Select
                placeholder="Select a profile"
                value={editProfileValue}
                onChange={(e) => setEditProfileValue(e.target.value)}
              >
                {existingProfiles.map(profile => (
                  <option key={profile} value={profile}>{profile}</option>
                ))}
                {/* Only show "Create New" option if the current value isn't in existing profiles */}
                {editProfileValue && !existingProfiles.includes(editProfileValue) && (
                  <option value={editProfileValue}>Create: {editProfileValue}</option>
                )}
              </Select>
              <Input
                mt={2}
                placeholder="Or type a new profile name"
                value={editProfileValue}
                onChange={(e) => setEditProfileValue(e.target.value)}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Select an existing profile or create a new one. Keys will rotate between different profiles.
              </Text>
            </FormControl>

            {/* Daily Rate Limit Input */}
            <FormControl mt={4}>
              <FormLabel>Daily Rate Limit (Requests)</FormLabel>
              <NumberInput
                value={editRateLimitValue}
                onChange={(valueAsString) => setEditRateLimitValue(valueAsString)}
                min={0} // Allow 0
                allowMouseWheel
              >
                <NumberInputField placeholder="Leave empty for no limit" />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Max requests per key per day (UTC). Leave empty or set to 0 for unlimited.
              </Text>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSaveChanges} // Use renamed handler
              isLoading={isSavingChanges} // Use renamed state
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Rate Limit Override Warning Dialog */}
      <AlertDialog
        isOpen={isWarnOpen}
        leastDestructiveRef={cancelRefWarn}
        onClose={() => { onWarnClose(); setKeyToToggle(null); }} // Clear key ID on close
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Enable Rate Limited Key?
            </AlertDialogHeader>

            <AlertDialogBody>
              This API key was automatically disabled because it hit its daily request limit.
              Manually enabling it now will allow it to be used again today, potentially exceeding the intended limit.
              Are you sure you want to proceed?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRefWarn} onClick={() => { onWarnClose(); setKeyToToggle(null); }}>
                Cancel
              </Button>
              <Button colorScheme="orange" onClick={() => keyToToggle && proceedWithToggle(keyToToggle)} ml={3}>
                Enable Anyway
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Bulk Limit Setting Modal */}
      <Modal isOpen={isBulkLimitOpen} onClose={onBulkLimitClose}>
          <ModalOverlay />
          <ModalContent>
              <ModalHeader>Set Daily Limit for Selected Keys ({selectedKeyIds.size})</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                  <FormControl isRequired>
                      <FormLabel>New Daily Rate Limit</FormLabel>
                      <NumberInput
                          value={bulkLimitValue}
                          onChange={(valueAsString) => setBulkLimitValue(valueAsString)}
                          min={0}
                          allowMouseWheel
                      >
                          <NumberInputField placeholder="Leave empty for no limit" />
                          <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                          </NumberInputStepper>
                      </NumberInput>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                          Enter the maximum requests per day for the selected keys. Leave empty or set to 0 for unlimited.
                      </Text>
                  </FormControl>
              </ModalBody>
              <ModalFooter>
                  <Button variant="ghost" mr={3} onClick={onBulkLimitClose} isDisabled={isApplyingBulkLimit}>
                      Cancel
                  </Button>
                  <Button
                      colorScheme="teal"
                      onClick={handleApplyBulkLimit}
                      isLoading={isApplyingBulkLimit}
                      isDisabled={selectedKeyIds.size === 0}
                  >
                      Apply Limit
                  </Button>
              </ModalFooter>
          </ModalContent>
      </Modal>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isBulkDeleteOpen}
        leastDestructiveRef={cancelRefBulkDelete}
        onClose={onBulkDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              <Flex align="center">
                <Box as={FiAlertTriangle} color="red.500" mr={2} />
                Delete Selected API Keys?
              </Flex>
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to permanently delete the selected <strong>{selectedKeyIds.size}</strong> API key(s)?
              This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRefBulkDelete} onClick={onBulkDeleteClose} isDisabled={isDeletingBulk}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleBulkDelete}
                ml={3}
                isLoading={isDeletingBulk}
              >
                Delete Keys
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

    </Box>
  );
}
