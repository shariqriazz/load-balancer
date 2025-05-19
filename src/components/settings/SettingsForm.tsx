import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EndpointSetting } from './EndpointSetting';
import { Settings } from '@/lib/db'; // Import Settings type from db.ts
import { useToast } from "@/hooks/use-toast";

export const SettingsForm: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
          title: 'Error fetching settings',
          description: 'Failed to load settings from the server',
          variant: 'destructive',
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
        description: 'Your changes have been saved',
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast({
        title: 'Error updating settings',
        description: 'Failed to save your changes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !settings) {
    return <div className="flex items-center justify-center p-6">Loading settings...</div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Your existing form fields would go here */}
        
        <Separator className="my-6" />
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">API Endpoint Configuration</h3>
          <EndpointSetting 
            value={settings?.endpoint || ''}
            onChange={(value) => setSettings(prev => prev ? {...prev, endpoint: value} : null)}
          />
        </div>
        
        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? "Saving..." : "Save All Settings"}
        </Button>
      </form>
    </div>
  );
};