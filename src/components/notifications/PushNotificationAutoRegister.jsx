import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

export default function PushNotificationAutoRegister() {
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Only attempt once per app load
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const registerPushNotifications = async () => {
      try {
        // Check browser support
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.log('Push notifications not supported');
          return;
        }

        // Check if permission already granted
        if (Notification.permission !== 'granted') {
          console.log('Push permission not granted yet');
          return;
        }

        // Get current user
        const user = await base44.auth.me();
        if (!user) {
          console.log('No authenticated user');
          return;
        }

        // Wait for service worker
        const registration = await navigator.serviceWorker.ready;
        
        // Check for existing subscription
        const existingSubscription = await registration.pushManager.getSubscription();
        
        if (existingSubscription) {
          // Check if already registered in backend
          const devices = await base44.entities.NotificationDevice.filter({
            user_id: user.id,
            push_token: JSON.stringify(existingSubscription),
            is_active: true
          });

          if (devices.length > 0) {
            // Update last_seen
            await base44.entities.NotificationDevice.update(devices[0].id, {
              last_seen_at: new Date().toISOString()
            });
            console.log('Push subscription refreshed');
            return;
          }

          // Register existing subscription to backend
          await base44.functions.invoke('registerNotificationDevice', {
            push_token: JSON.stringify(existingSubscription),
            device_type: 'web'
          });
          console.log('Push subscription registered to backend');
        }
      } catch (error) {
        console.error('Auto push registration error:', error);
      }
    };

    // Delay slightly to not block initial render
    const timer = setTimeout(registerPushNotifications, 2000);
    return () => clearTimeout(timer);
  }, []);

  return null; // This component doesn't render anything
}