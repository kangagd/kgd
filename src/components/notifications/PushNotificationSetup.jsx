import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function PushNotificationSetup() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkRegistration();
    }
  }, []);

  const checkRegistration = async () => {
    try {
      // Check if we have a registered device in the backend
      const user = await base44.auth.me();
      if (user) {
        const devices = await base44.entities.NotificationDevice.filter({
          user_id: user.id,
          is_active: true,
          device_type: 'web'
        });
        setIsRegistered(devices.length > 0);
      }
    } catch (error) {
      console.error('Error checking registration:', error);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const enableNotifications = async () => {
    if (isLoading) return; // Prevent double-clicks
    setIsLoading(true);
    
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error('Notification permission denied');
        setIsLoading(false);
        return;
      }

      // Get VAPID public key from backend first
      const vapidResponse = await base44.functions.invoke('getVapidPublicKey');
      if (!vapidResponse.data?.vapidPublicKey) {
        throw new Error('Failed to get VAPID public key');
      }
      const vapidPublicKey = vapidResponse.data.vapidPublicKey;

      // Get or wait for existing service worker
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        // Wait for the platform's service worker to be ready
        registration = await navigator.serviceWorker.ready;
      }

      // Subscribe to push notifications
      let subscription = await registration.pushManager.getSubscription();
      
      // If no subscription or different key, create new subscription
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // Send subscription to backend
      const response = await base44.functions.invoke('registerNotificationDevice', {
        push_token: JSON.stringify(subscription),
        device_type: 'web'
      });

      if (response.data.success) {
        setIsRegistered(true);
        toast.success('Push notifications enabled!');
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const disableNotifications = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        setIsRegistered(false);
        toast.success('Push notifications disabled');
      }
    } catch (error) {
      console.error('Error disabling notifications:', error);
      toast.error('Failed to disable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BellOff className="w-5 h-5" />
            Push Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser doesn't support push notifications. Try using Chrome, Firefox, or Edge on mobile.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified when someone mentions you in chat or when job updates occur.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-gray-500">
                {isRegistered ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            {isRegistered ? (
              <Button
                variant="outline"
                onClick={disableNotifications}
                disabled={isLoading}
                className="min-h-[44px] min-w-[100px]"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <BellOff className="w-4 h-4 mr-2" />
                Disable
              </Button>
            ) : (
              <Button
                onClick={enableNotifications}
                disabled={isLoading || permission === 'denied'}
                className="bg-[#FAE008] text-gray-900 hover:bg-[#E5CF07] min-h-[44px] min-w-[100px]"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Bell className="w-4 h-4 mr-2" />
                Enable
              </Button>
            )}
          </div>

          {permission === 'denied' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              You've blocked notifications. Please reset permissions in your browser settings.
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p>• You'll be notified when mentioned in chat</p>
            <p>• Works on mobile browsers (Chrome, Firefox, Edge)</p>
            <p>• Notifications work even when the app is closed</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}