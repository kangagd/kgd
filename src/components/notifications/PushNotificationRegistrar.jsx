import { useEffect, useRef } from "react";
import { 
  isPushSupported, 
  getPermissionStatus, 
  isUserSubscribed,
  subscribeToNotifications,
  setExternalUserId
} from "./oneSignalUtils";

/**
 * Silent background component that auto-registers push notifications
 * when user is logged in and has already granted permission.
 * 
 * Does NOT prompt for permission - only subscribes if already granted.
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

        // Only auto-subscribe if permission is ALREADY granted
        if (getPermissionStatus() !== 'granted') {
          console.log('[PushRegistrar] Permission not granted, skipping');
          return;
        }

        // Check if already subscribed
        const alreadySubscribed = await isUserSubscribed();
        if (alreadySubscribed) {
          console.log('[PushRegistrar] Already subscribed');
          // Still link user ID in case it wasn't set
          await setExternalUserId(user.id, user.email);
          return;
        }

        // Auto-subscribe
        console.log('[PushRegistrar] Auto-subscribing...');
        hasAttempted.current = true;

        const result = await subscribeToNotifications();
        if (result.success) {
          // Link the user ID
          await setExternalUserId(user.id, user.email);
        }
        console.log('[PushRegistrar] Result:', result.success ? 'success' : result.message);
      } catch (error) {
        console.error('[PushRegistrar] Error:', error);
      }
    };

    // Delay to allow OneSignal to initialize first
    const timer = setTimeout(silentRegister, 2000);
    return () => clearTimeout(timer);
  }, [user?.id]);

  return null;
}