import React, { useState, useEffect } from 'react'; // Added useEffect import
import {
  FormControl,
  FormLabel,
  Input,
  Button,
  HStack,
  useToast,
  Text,
  Box,
  Tooltip,
  Icon,
} from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';

interface EndpointSettingProps {
  value: string;
  onChange: (value: string) => void;
}

export const EndpointSetting: React.FC<EndpointSettingProps> = ({ value, onChange }) => {
  const [inputValue, setInputValue] = useState(value);
  const toast = useToast();

  // Update local state when prop value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSave = () => {
    // Basic validation to ensure it's a valid URL
    try {
      // Check if it's a valid URL
      new URL(inputValue);
      console.log('Saving endpoint:', inputValue); // Add logging
      onChange(inputValue);
      toast({
        title: 'Endpoint updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL for the endpoint',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleReset = () => {
    const defaultEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai';
    setInputValue(defaultEndpoint);
    onChange(defaultEndpoint);
    toast({
      title: 'Endpoint reset to default',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <FormControl>
      <FormLabel display="flex" alignItems="center">
        API Endpoint
        <Tooltip 
          label="The base URL for the OpenAI-compatible API. The paths '/chat/completions' and '/models' will be appended to this URL."
          placement="top"
        >
          <Box display="inline-block" ml={2}>
            <Icon as={InfoIcon} color="gray.500" />
          </Box>
        </Tooltip>
      </FormLabel>
      <Input
        value={inputValue}
        onChange={handleChange} // Using the handleChange function defined above
        placeholder="https://api.example.com/v1"
        mb={2}
      />
      <Text fontSize="sm" color="gray.500" mb={3}>
        Example: https://generativelanguage.googleapis.com/v1beta/openai
      </Text>
      <HStack>
        <Button colorScheme="blue" onClick={handleSave}>
          Save
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset to Default
        </Button>
      </HStack>
    </FormControl>
  );
};