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
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsRegistered(!!subscription);
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

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY'; // This should come from your backend
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Get user info
      const user = await base44.auth.me();

      // Send subscription to backend
      const response = await base44.functions.invoke('registerNotificationDevice', {
        device_token: JSON.stringify(subscription),
        platform: 'web',
        user_email: user.email,
        user_name: user.full_name
      });

      if (response.data.success) {
        setIsRegistered(true);
        toast.success('Push notifications enabled!');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast.error('Failed to enable notifications');
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
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if (!isLoading) disableNotifications();
                }}
                disabled={isLoading}
                className="min-h-[44px] min-w-[100px] touch-manipulation"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <BellOff className="w-4 h-4 mr-2" />
                Disable
              </Button>
            ) : (
              <Button
                onClick={enableNotifications}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if (!isLoading && permission !== 'denied') enableNotifications();
                }}
                disabled={isLoading || permission === 'denied'}
                className="bg-[#FAE008] text-gray-900 hover:bg-[#E5CF07] min-h-[44px] min-w-[100px] touch-manipulation"
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