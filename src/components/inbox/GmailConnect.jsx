import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function GmailConnect({ user, onSyncComplete }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    setIsConnected(!!user?.gmail_access_token);
  }, [user]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'gmail_auth_success') {
        setIsConnected(true);
        handleSync();
      } else if (event.data.type === 'gmail_auth_error') {
        toast.error('Gmail authentication failed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = async () => {
    try {
      const response = await base44.functions.invoke('gmailAuth', {});
      if (response.data.authUrl) {
        const popup = window.open(
          response.data.authUrl,
          'Gmail Auth',
          'width=600,height=700'
        );
      }
    } catch (error) {
      toast.error('Failed to connect to Gmail');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const response = await base44.functions.invoke('gmailSync', {});
      toast.success(`Synced ${response.data.synced} new emails`);
      if (onSyncComplete) onSyncComplete();
    } catch (error) {
      toast.error(error.message || 'Failed to sync emails');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isConnected) {
    return (
      <Button onClick={handleConnect} variant="outline" size="sm">
        Connect Gmail
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSync}
      disabled={isSyncing}
      variant="ghost"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
      {isSyncing ? 'Syncing...' : 'Sync'}
    </Button>
  );
}