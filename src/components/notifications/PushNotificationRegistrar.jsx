import { useEffect, useRef } from "react";
import { 
  isPushSupported, 
  getPermissionStatus, 
  registerForPushNotifications,
  getActiveSubscriptionForDevice 
} from "./pushUtils";

/**
 * Silent background component that auto-registers push notifications
 * when user is logged in and has already granted permission.
 * 
 * Does NOT prompt for permission - only registers if already granted.
 */
export default function PushNotificationRegistrar({ user }) {
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!user || hasAttempted.current) return;

    const silentRegister = async () => {
      try {
        // Only proceed if push is supported
        if (!isPushSupported()) {
          console.log('[PushRegistrar] Push not supported');
          return;
        }

        // Only auto-register if permission is ALREADY granted
        if (getPermissionStatus() !== 'granted') {
          console.log('[PushRegistrar] Permission not granted, skipping');
          return;
        }

        // Check if already registered
        const existingSub = await getActiveSubscriptionForDevice(user.id);
        if (existingSub) {
          console.log('[PushRegistrar] Already registered');
          return;
        }

        // Auto-register
        console.log('[PushRegistrar] Auto-registering...');
        hasAttempted.current = true;

        const result = await registerForPushNotifications(user);
        console.log('[PushRegistrar] Result:', result.success ? 'success' : result.message);
      } catch (error) {
        console.error('[PushRegistrar] Error:', error);
      }
    };

    silentRegister();
  }, [user?.id]);

  return null;
}