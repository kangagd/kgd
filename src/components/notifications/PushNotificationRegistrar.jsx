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
 * The PushNotificationSetup component handles explicit user interaction.
 */
export default function PushNotificationRegistrar({ user }) {
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!user || hasAttempted.current) return;

    const silentRegister = async () => {
      // Only proceed if push is supported
      if (!isPushSupported()) {
        console.log('[PushRegistrar] Push not supported');
        return;
      }

      // Only auto-register if permission is ALREADY granted
      // Never prompt for permission in background
      if (getPermissionStatus() !== 'granted') {
        console.log('[PushRegistrar] Permission not granted, skipping auto-register');
        return;
      }

      // Check if already registered for this device
      const existingSub = await getActiveSubscriptionForDevice(user.id);
      if (existingSub) {
        console.log('[PushRegistrar] Device already registered');
        return;
      }

      // Auto-register since permission is granted but device not registered
      console.log('[PushRegistrar] Auto-registering device...');
      hasAttempted.current = true;

      const result = await registerForPushNotifications(user);
      if (result.success) {
        console.log('[PushRegistrar] Auto-registration successful');
      } else {
        console.log('[PushRegistrar] Auto-registration failed:', result.message);
      }
    };

    silentRegister();
  }, [user]);

  // This component renders nothing
  return null;
}