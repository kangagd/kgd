import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { ExternalLink, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import XeroSettingsModal from "./XeroSettingsModal";

export default function XeroConnectButton() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: xeroConnections = [] } = useQuery({
    queryKey: ['xeroConnection'],
    queryFn: () => base44.entities.XeroConnection.list()
  });

  const { data: xeroSettings = [] } = useQuery({
    queryKey: ['xeroSettings'],
    queryFn: () => base44.entities.XeroSettings.list()
  });

  const isConnected = xeroConnections.length > 0;
  const hasSettings = xeroSettings.length > 0;

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await base44.functions.invoke('connectToXero', {});
      const authUrl = response.data.authUrl;
      
      // Open Xero auth in new window
      window.open(authUrl, '_blank', 'width=600,height=700');
      
      // Refresh connection status after a delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Xero connection error:', error);
      alert('Failed to connect to Xero');
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Xero Connected</span>
          </div>
          <Button
            onClick={() => setShowSettings(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            {hasSettings ? 'Settings' : 'Configure'}
          </Button>
        </div>
        <XeroSettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      </>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      variant="outline"
      className="gap-2"
    >
      <ExternalLink className="w-4 h-4" />
      {isConnecting ? 'Connecting...' : 'Connect to Xero'}
    </Button>
  );
}