import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Smartphone, Monitor, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BLBx-hf5h3SAQ5fvT2xMZHy4iNxKbEQKLX8BYWvP4xJPqGLw3Ns-Ks6kZ6nPZKBwLK9nP5ZwXPPkPmz7_P5PQAQ";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationSetup({ user }) {
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [isSupported, setIsSupported] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    // Check browser support
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermissionStatus(Notification.permission);
    }

    // Load existing subscriptions
    if (user) {
      loadSubscriptions();
    }
  }, [user]);

  const loadSubscriptions = async () => {
    setIsLoading(true);
    try {
      const subs = await base44.entities.PushSubscription.filter({ user_id: user.id });
      setSubscriptions(subs.filter(s => s.active));
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    }
    setIsLoading(false);
  };

  const enablePushNotifications = async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return;
    }

    setIsEnabling(true);
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission !== 'granted') {
        toast.error('Notification permission denied');
        setIsEnabling(false);
        return;
      }

      // Check if service worker is available
      if (!navigator.serviceWorker.controller) {
        // Try to register service worker if not available
        console.log('No service worker controller, waiting for registration...');
        toast.info('Setting up push notifications...');
      }

      // Get service worker registration with timeout
      const registrationPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Service worker timeout')), 10000)
      );

      let registration;
      try {
        registration = await Promise.race([registrationPromise, timeoutPromise]);
      } catch (err) {
        console.error('Service worker not ready:', err);
        toast.error('Push notifications require a service worker. Please reload the page.');
        setIsEnabling(false);
        return;
      }

      // Subscribe to push
      let subscription;
      try {
        subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        }
      } catch (err) {
        console.error('Push subscription failed:', err);
        toast.error('Failed to subscribe to push notifications. ' + (err.message || ''));
        setIsEnabling(false);
        return;
      }

      const subscriptionJson = JSON.stringify(subscription.toJSON());
      const deviceInfo = navigator.userAgent;

      // Check for existing subscription with same endpoint
      const existingSubscriptions = await base44.entities.PushSubscription.filter({
        user_id: user.id,
        platform: 'web'
      });

      const existingWithSameEndpoint = existingSubscriptions.find(s => {
        try {
          const parsed = JSON.parse(s.subscription_json || '{}');
          return parsed.endpoint === subscription.endpoint;
        } catch {
          return false;
        }
      });

      if (existingWithSameEndpoint) {
        await base44.entities.PushSubscription.update(existingWithSameEndpoint.id, {
          active: true,
          last_seen: new Date().toISOString(),
          subscription_json: subscriptionJson,
          device_info: deviceInfo
        });
      } else {
        await base44.entities.PushSubscription.create({
          user_id: user.id,
          user_email: user.email,
          platform: 'web',
          subscription_json: subscriptionJson,
          active: true,
          last_seen: new Date().toISOString(),
          device_info: deviceInfo
        });
      }

      toast.success('Push notifications enabled!');
      await loadSubscriptions();
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      toast.error('Failed to enable push notifications: ' + (error.message || 'Unknown error'));
    }
    setIsEnabling(false);
  };

  const disableSubscription = async (subId) => {
    try {
      await base44.entities.PushSubscription.update(subId, { active: false });
      toast.success('Device removed');
      await loadSubscriptions();
    } catch (error) {
      toast.error('Failed to remove device');
    }
  };

  const sendTestNotification = async () => {
    setIsTesting(true);
    try {
      const response = await base44.functions.invoke('testPushNotification', {});
      if (response.data.success) {
        toast.success(response.data.message || 'Test notification sent!');
      } else {
        toast.error(response.data.message || 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Test notification error:', error);
      toast.error('Failed to send test notification');
    }
    setIsTesting(false);
  };

  const getDeviceName = (deviceInfo) => {
    if (!deviceInfo) return 'Unknown Device';
    if (deviceInfo.includes('iPhone') || deviceInfo.includes('iPad')) return 'iOS Device';
    if (deviceInfo.includes('Android')) return 'Android Device';
    if (deviceInfo.includes('Mac')) return 'Mac';
    if (deviceInfo.includes('Windows')) return 'Windows PC';
    if (deviceInfo.includes('Linux')) return 'Linux';
    return 'Web Browser';
  };

  const isCurrentDevice = (sub) => {
    try {
      const parsed = JSON.parse(sub.subscription_json || '{}');
      // Check if this subscription matches current browser
      return navigator.userAgent === sub.device_info;
    } catch {
      return false;
    }
  };

  if (!isSupported) {
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
        {/* Permission Status */}
        <div className="flex items-center justify-between py-3 border-b border-[#E5E7EB]">
          <div>
            <p className="text-[14px] font-medium text-[#111827]">Browser Permission</p>
            <p className="text-[12px] text-[#6B7280]">
              {permissionStatus === 'granted' ? 'Notifications are allowed' : 
               permissionStatus === 'denied' ? 'Notifications are blocked' : 
               'Permission not yet requested'}
            </p>
          </div>
          <Badge variant={permissionStatus === 'granted' ? 'success' : permissionStatus === 'denied' ? 'error' : 'secondary'}>
            {permissionStatus === 'granted' ? 'Enabled' : permissionStatus === 'denied' ? 'Blocked' : 'Not Set'}
          </Badge>
        </div>

        {/* Enable Button */}
        {permissionStatus !== 'granted' && permissionStatus !== 'denied' && (
          <Button 
            onClick={enablePushNotifications} 
            disabled={isEnabling}
            className="w-full bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            {isEnabling ? (
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

        {permissionStatus === 'granted' && subscriptions.length === 0 && !isLoading && (
          <Button 
            onClick={enablePushNotifications} 
            disabled={isEnabling}
            className="w-full bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            {isEnabling ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 mr-2" />
                Register This Device
              </>
            )}
          </Button>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-5 h-5 animate-spin text-[#6B7280]" />
            <span className="ml-2 text-[14px] text-[#6B7280]">Loading...</span>
          </div>
        )}

        {permissionStatus === 'denied' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-[13px] text-red-700">
              Notifications are blocked. Please enable them in your browser settings and reload the page.
            </p>
          </div>
        )}

        {/* Test Button */}
        {subscriptions.length > 0 && (
          <Button 
            onClick={sendTestNotification} 
            disabled={isTesting}
            variant="outline"
            className="w-full"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sending Test...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Send Test Notification
              </>
            )}
          </Button>
        )}

        {/* Registered Devices */}
        {subscriptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[14px] font-medium text-[#111827]">Registered Devices</p>
            {subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                <div className="flex items-center gap-3">
                  <Monitor className="w-4 h-4 text-[#6B7280]" />
                  <div>
                    <p className="text-[14px] font-medium text-[#111827]">
                      {getDeviceName(sub.device_info)}
                      {isCurrentDevice(sub) && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">This device</Badge>
                      )}
                    </p>
                    <p className="text-[12px] text-[#6B7280]">
                      Last active: {new Date(sub.last_seen).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => disableSubscription(sub.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}