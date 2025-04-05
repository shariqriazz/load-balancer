import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Divider,
  Heading,
  useToast,
  VStack,
  // Add any other Chakra UI components you need
} from '@chakra-ui/react';
import { EndpointSetting } from './EndpointSetting';
import { Settings } from '@/lib/db'; // Import Settings type from db.ts

export const SettingsForm: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        setSettings(data);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch settings',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data.settings);
      toast({
        title: 'Settings updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !settings) {
    return <Box>Loading settings...</Box>;
  }

  return (
    <Box as="form" onSubmit={handleSubmit} width="100%" maxWidth="800px" mx="auto">
      {/* Your existing form fields would go here */}
      
      <Divider my={6} />
      
      <Heading size="md" mb={4}>API Endpoint Configuration</Heading>
      <EndpointSetting 
        value={settings?.endpoint || ''}
        onChange={(value) => setSettings(prev => prev ? {...prev, endpoint: value} : null)}
      />
      
      <Button 
        mt={6} 
        colorScheme="blue" 
        type="submit" 
        isLoading={isLoading}
      >
        Save All Settings
      </Button>
    </Box>
  );
};