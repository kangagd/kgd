import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

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
        setSyncStatus({ type: 'error', message: 'Authentication failed' });
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
      setSyncStatus({ type: 'error', message: error.message });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const response = await base44.functions.invoke('gmailSync', {});
      setSyncStatus({
        type: 'success',
        message: `Synced ${response.data.synced} new emails`
      });
      if (onSyncComplete) onSyncComplete();
    } catch (error) {
      setSyncStatus({ type: 'error', message: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="border border-[#E5E7EB] mb-5">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isConnected ? 'bg-green-100' : 'bg-[#F3F4F6]'
            }`}>
              <Mail className={`w-5 h-5 ${isConnected ? 'text-green-600' : 'text-[#6B7280]'}`} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[#111827]">Gmail Integration</h3>
              <p className="text-[12px] text-[#6B7280]">
                {isConnected 
                  ? `Connected as ${user?.gmail_email || 'Gmail user'}`
                  : 'Connect your Gmail to sync emails'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isConnected ? (
              <Button onClick={handleConnect} size="sm">
                Connect Gmail
              </Button>
            ) : (
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </div>
        </div>

        {syncStatus && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
            syncStatus.type === 'success' 
              ? 'bg-green-50 text-green-800' 
              : 'bg-red-50 text-red-800'
          }`}>
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-[13px]">{syncStatus.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}