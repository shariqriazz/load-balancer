import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface EndpointSettingProps {
  value: string;
  onChange: (value: string) => void;
}

export const EndpointSetting: React.FC<EndpointSettingProps> = ({ value, onChange }) => {
  const [inputValue, setInputValue] = useState(value);
  const { toast } = useToast();

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
      console.log('Saving endpoint:', inputValue);
      onChange(inputValue);
      toast({
        title: 'Endpoint updated',
        description: 'The API endpoint has been updated',
      });
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL for the endpoint',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    const defaultEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai';
    setInputValue(defaultEndpoint);
    onChange(defaultEndpoint);
    toast({
      title: 'Endpoint reset',
      description: 'Endpoint has been reset to default value',
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center">
          <Label htmlFor="endpoint-input">API Endpoint</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 ml-2 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  The base URL for the OpenAI-compatible API. The paths '/chat/completions' 
                  and '/models' will be appended to this URL.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <Input
          id="endpoint-input"
          value={inputValue}
          onChange={handleChange}
          placeholder="https://api.example.com/v1"
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          Example: https://generativelanguage.googleapis.com/v1beta/openai
        </p>
      </div>
      
      <div className="flex space-x-2">
        <Button onClick={handleSave}>
          Save
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset to Default
        </Button>
      </div>
    </div>
  );
};