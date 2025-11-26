import { useEffect, useState } from "react";
import { initializeOneSignal, setExternalUserId, setUserTags } from "./oneSignalUtils";

const ONESIGNAL_APP_ID = "50b86e27-3335-48dc-877c-4e4f3d223620";

/**
 * OneSignal Initializer Component
 * Loads the OneSignal SDK and initializes it with the app ID
 * Should be placed in the Layout component
 */
export default function OneSignalInitializer({ user }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const loadAndInitOneSignal = async () => {
      try {
        // Load OneSignal SDK script if not already loaded
        if (!document.getElementById('onesignal-sdk')) {
          const script = document.createElement('script');
          script.id = 'onesignal-sdk';
          script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
          script.defer = true;
          document.head.appendChild(script);
          
          // Wait for script to load
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        // Initialize OneSignal
        const success = await initializeOneSignal(ONESIGNAL_APP_ID);
        setInitialized(success);

        // If user is logged in, link their account
        if (success && user) {
          await setExternalUserId(user.id, user.email);
          
          // Set user tags for targeting
          await setUserTags({
            role: user.role || 'user',
            is_technician: user.is_field_technician ? 'true' : 'false'
          });
        }
      } catch (error) {
        console.error('[OneSignal] Failed to initialize:', error);
      }
    };

    loadAndInitOneSignal();
  }, [user?.id]);

  // This component doesn't render anything visible
  return null;
}