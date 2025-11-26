import { useEffect, useRef } from "react";

const ONESIGNAL_APP_ID = "50b86e27-3335-48dc-877c-4e4f3d223620";

/**
 * OneSignal Initializer Component
 * Since Base44 doesn't support custom service workers, we cannot use OneSignal's 
 * web push on this platform. This component is disabled.
 * 
 * For push notifications on Base44, you would need to:
 * 1. Use a native mobile app wrapper
 * 2. Or use email/SMS notifications instead
 */
export default function OneSignalInitializer({ user }) {
  // OneSignal web push requires service worker files hosted at your domain root
  // Base44 doesn't support this, so web push notifications won't work
  // The component is kept but disabled to prevent errors
  
  return null;
}