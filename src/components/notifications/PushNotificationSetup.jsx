import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  isPushSupported,
  getPermissionStatus,
  getDeviceName,
  getDeviceInfo,
  isUserSubscribed,
  subscribeToNotifications,
  unsubscribeFromNotifications
} from "./oneSignalUtils";

export default function PushNotificationSetup({ user }) {
  // Core state
  const [isSupported, setIsSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Check status on mount
  const checkStatus = useCallback(async () => {
    console.log('[PushSetup] checkStatus called');
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      if (!user) {
        console.log('[PushSetup] No user');
        return;
      }

      // Check browser support
      const supported = isPushSupported();
      console.log('[PushSetup] Supported:', supported);
      setIsSupported(supported);
      
      if (!supported) {
        return;
      }

      // Get permission status
      const permission = getPermissionStatus();
      console.log('[PushSetup] Permission:', permission);
      setPermissionStatus(permission);

      // Check if subscribed via OneSignal
      const subscribed = await isUserSubscribed();
      console.log('[PushSetup] Subscribed:', subscribed);
      setIsSubscribed(subscribed);
    } catch (error) {
      console.error('[PushSetup] checkStatus error:', error);
      setErrorMessage('Failed to check notification status');
    } finally {
      console.log('[PushSetup] checkStatus complete');
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // Small delay to allow OneSignal to initialize
    const timer = setTimeout(() => {
      checkStatus();
    }, 1000);
    return () => clearTimeout(timer);
  }, [checkStatus]);

  // Handle enable/subscribe button click
  const handleEnableNotifications = async () => {
    if (!user) return;
    
    console.log('[PushSetup] handleEnableNotifications called');
    setIsRegistering(true);
    setErrorMessage('');
    
    try {
      const result = await subscribeToNotifications();
      console.log('[PushSetup] Subscription result:', result);
      
      // Update states
      setPermissionStatus(getPermissionStatus());
      
      if (result.success) {
        toast.success(result.message);
        setIsSubscribed(true);
      } else {
        toast.error(result.message);
        setErrorMessage(result.message);
      }
    } catch (error) {
      console.error('[PushSetup] Subscription error:', error);
      const msg = 'Subscription failed. Please try again.';
      toast.error(msg);
      setErrorMessage(msg);
    } finally {
      console.log('[PushSetup] handleEnableNotifications complete');
      setIsRegistering(false);
    }
  };

  // Handle unsubscribe
  const handleDisableNotifications = async () => {
    setIsRegistering(true);
    try {
      const result = await unsubscribeFromNotifications();
      if (result.success) {
        toast.success('Notifications disabled');
        setIsSubscribed(false);
      } else {
        toast.error(result.message || 'Failed to disable notifications');
      }
    } catch (error) {
      toast.error('Failed to disable notifications');
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle test notification - uses VAPID-based push (testPushNotification)
  const handleTestNotification = async () => {
    console.log('[PushSetup] handleTestNotification called');
    setIsTesting(true);
    
    try {
      const response = await base44.functions.invoke('testPushNotification', {});
      
      console.log('[PushSetup] Response:', response.data);
      
      if (response.data?.success) {
        toast.success(response.data.message || 'Test notification sent!');
      } else {
        toast.error(response.data?.message || 'Failed to send test notification');
      }
    } catch (error) {
      console.error('[PushSetup] Test notification error:', error);
      toast.error('Failed to send test notification');
    } finally {
      console.log('[PushSetup] handleTestNotification complete');
      setIsTesting(false);
    }
  };

  // Not supported
  if (!isSupported && !isLoading) {
    return (
      <Card className="border border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[18px] font-semibold text-[#111827]">
            <BellOff className="w-5 h-5 text-[#6B7280]" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[14px] text-[#6B7280]">
            Push notifications are not supported in this browser. Try using Chrome, Firefox, or Edge.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine what to show
  const showEnableButton = !isSubscribed && permissionStatus !== 'denied';
  const showEnabledState = isSubscribed;

  return (
    <Card className="border border-[#E5E7EB]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[18px] font-semibold text-[#111827]">
          <Bell className="w-5 h-5 text-[#FAE008]" />
          Push Notifications
        </CardTitle>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Receive notifications even when the app is closed
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="w-5 h-5 animate-spin text-[#6B7280]" />
            <span className="ml-2 text-[14px] text-[#6B7280]">Checking status...</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Status Display */}
            <div className="flex items-center justify-between py-3 border-b border-[#E5E7EB]">
              <div>
                <p className="text-[14px] font-medium text-[#111827]">This Device</p>
                <p className="text-[12px] text-[#6B7280]">
                  {permissionStatus === 'denied' 
                    ? 'Notifications blocked in browser settings'
                    : showEnabledState 
                      ? 'Subscribed and receiving notifications'
                      : 'Not subscribed to notifications'}
                </p>
                <p className="text-[11px] text-[#9CA3AF] mt-1">
                  {getDeviceName(getDeviceInfo())}
                </p>
              </div>
              <Badge variant={showEnabledState ? 'success' : permissionStatus === 'denied' ? 'error' : 'secondary'}>
                {showEnabledState ? 'Enabled' : permissionStatus === 'denied' ? 'Blocked' : 'Not Enabled'}
              </Badge>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-[13px] text-red-700">{errorMessage}</p>
              </div>
            )}

            {/* Enable Button */}
            {showEnableButton && (
              <Button 
                onClick={handleEnableNotifications} 
                disabled={isRegistering}
                className="w-full bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
              >
                {isRegistering ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Enable Push Notifications
                  </>
                )}
              </Button>
            )}

            {/* Enabled State */}
            {showEnabledState && (
              <>
                <div className="flex items-center gap-2 py-3 px-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-[14px] text-green-700 font-medium">
                    Push notifications are enabled
                  </span>
                </div>
                
                {/* Test Button */}
                <Button 
                  onClick={handleTestNotification} 
                  disabled={isTesting}
                  variant="outline"
                  className="w-full"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Send Test Notification
                    </>
                  )}
                </Button>

                {/* Disable Button */}
                <Button 
                  onClick={handleDisableNotifications} 
                  disabled={isRegistering}
                  variant="ghost"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {isRegistering ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    'Disable Notifications'
                  )}
                </Button>
              </>
            )}

            {/* Blocked State */}
            {permissionStatus === 'denied' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-[13px] text-red-700">
                  Notifications are blocked. Enable them in your browser settings and reload the page.
                </p>
              </div>
            )}

            {/* Refresh Button */}
            <Button 
              onClick={checkStatus} 
              variant="ghost" 
              size="sm"
              className="w-full text-[#6B7280]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}