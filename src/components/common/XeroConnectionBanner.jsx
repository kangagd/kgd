import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function XeroConnectionBanner() {
  const [isReconnecting, setIsReconnecting] = React.useState(false);

  const { data: xeroConnection } = useQuery({
    queryKey: ['xeroConnection'],
    queryFn: async () => {
      const connections = await base44.entities.XeroConnection.list();
      return connections[0] || null;
    },
    staleTime: 60000, // Check every minute
    refetchInterval: 60000
  });

  // Check if connection is expired or missing
  const needsReconnection = !xeroConnection || xeroConnection.is_expired;

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const response = await base44.functions.invoke('connectToXero');
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } catch (error) {
      toast.error('Failed to initiate Xero connection');
      setIsReconnecting(false);
    }
  };

  if (!needsReconnection) return null;

  return (
    <div className="bg-red-50 border-b-2 border-red-200 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-900">
            Xero Connection Required
          </p>
          <p className="text-xs text-red-700">
            Your Xero connection has expired. Reconnect to access invoicing features.
          </p>
        </div>
      </div>
      <Button
        onClick={handleReconnect}
        disabled={isReconnecting}
        size="sm"
        className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
      >
        {isReconnecting ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Reconnecting...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reconnect Xero
          </>
        )}
      </Button>
    </div>
  );
}