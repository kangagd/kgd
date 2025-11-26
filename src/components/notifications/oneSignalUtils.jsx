/**
 * OneSignal Push Notification Utilities
 * Handles all OneSignal SDK interactions for push notifications
 */

// Get OneSignal App ID from environment or hardcode for now
// In production, this should come from your backend
const ONESIGNAL_APP_ID = null; // Will be set during initialization

/**
 * Check if OneSignal SDK is loaded
 */
export function isOneSignalLoaded() {
  return typeof window !== 'undefined' && window.OneSignalDeferred;
}

/**
 * Initialize OneSignal SDK
 * Should be called once when the app loads
 */
export async function initializeOneSignal(appId) {
  if (typeof window === 'undefined') return false;

  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: false,
          },
          // Disable service worker - use HTTP fallback mode
          autoResubscribe: true,
          promptOptions: {
            slidedown: {
              prompts: [
                {
                  type: "push",
                  autoPrompt: false,
                  text: {
                    actionMessage: "Enable notifications to get updates on your jobs and projects.",
                    acceptButton: "Allow",
                    cancelButton: "No Thanks"
                  }
                }
              ]
            }
          }
        });
        console.log('[OneSignal] Initialized successfully');
        resolve(true);
      } catch (error) {
        console.error('[OneSignal] Initialization error:', error);
        resolve(false);
      }
    });
  });
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return typeof window !== 'undefined' && 
         'Notification' in window && 
         'serviceWorker' in navigator;
}

/**
 * Get current notification permission status
 * Returns: 'default', 'granted', 'denied', or 'unsupported'
 */
export function getPermissionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Check if user is subscribed to push notifications via OneSignal
 */
export async function isUserSubscribed() {
  if (!isOneSignalLoaded()) return false;
  
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        const isPushEnabled = await OneSignal.Notifications.permission;
        const isOptedIn = await OneSignal.User.PushSubscription.optedIn;
        resolve(isPushEnabled && isOptedIn);
      } catch (error) {
        console.error('[OneSignal] Error checking subscription:', error);
        resolve(false);
      }
    });
  });
}

/**
 * Get the OneSignal Player ID (subscription ID)
 */
export async function getPlayerId() {
  if (!isOneSignalLoaded()) return null;
  
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        const id = await OneSignal.User.PushSubscription.id;
        resolve(id);
      } catch (error) {
        console.error('[OneSignal] Error getting player ID:', error);
        resolve(null);
      }
    });
  });
}

/**
 * Request permission and subscribe to push notifications
 */
export async function subscribeToNotifications() {
  if (!isOneSignalLoaded()) {
    return { success: false, message: 'OneSignal not loaded' };
  }
  
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        // Request permission
        await OneSignal.Notifications.requestPermission();
        
        const permission = await OneSignal.Notifications.permission;
        
        if (!permission) {
          resolve({ success: false, message: 'Permission denied' });
          return;
        }
        
        // Opt in to push
        await OneSignal.User.PushSubscription.optIn();
        
        const playerId = await OneSignal.User.PushSubscription.id;
        
        resolve({ 
          success: true, 
          message: 'Successfully subscribed to notifications',
          playerId 
        });
      } catch (error) {
        console.error('[OneSignal] Subscription error:', error);
        resolve({ success: false, message: error.message || 'Failed to subscribe' });
      }
    });
  });
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromNotifications() {
  if (!isOneSignalLoaded()) {
    return { success: false, message: 'OneSignal not loaded' };
  }
  
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.User.PushSubscription.optOut();
        resolve({ success: true, message: 'Successfully unsubscribed' });
      } catch (error) {
        console.error('[OneSignal] Unsubscribe error:', error);
        resolve({ success: false, message: error.message || 'Failed to unsubscribe' });
      }
    });
  });
}

/**
 * Set external user ID (to link OneSignal subscription to your user)
 */
export async function setExternalUserId(userId, email) {
  if (!isOneSignalLoaded()) {
    console.log('[OneSignal] SDK not loaded, cannot set external user ID');
    return false;
  }
  
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        console.log('[OneSignal] Setting external user ID:', userId);
        
        // Set external user ID
        await OneSignal.login(userId);
        
        // Set email tag for targeting
        if (email) {
          await OneSignal.User.addEmail(email);
          await OneSignal.User.addTag('email', email);
        }
        
        // Log the subscription status after login
        const subId = await OneSignal.User.PushSubscription.id;
        const optedIn = await OneSignal.User.PushSubscription.optedIn;
        console.log('[OneSignal] After login - Subscription ID:', subId, 'OptedIn:', optedIn);
        
        resolve(true);
      } catch (error) {
        console.error('[OneSignal] Error setting external user ID:', error);
        resolve(false);
      }
    });
  });
}

/**
 * Add tags to the user (for segmentation and targeting)
 */
export async function setUserTags(tags) {
  if (!isOneSignalLoaded()) return false;
  
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.User.addTags(tags);
        resolve(true);
      } catch (error) {
        console.error('[OneSignal] Error setting tags:', error);
        resolve(false);
      }
    });
  });
}

/**
 * Logout from OneSignal (removes external user ID)
 */
export async function logoutOneSignal() {
  if (!isOneSignalLoaded()) return false;
  
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.logout();
        resolve(true);
      } catch (error) {
        console.error('[OneSignal] Logout error:', error);
        resolve(false);
      }
    });
  });
}

/**
 * Get device info string
 */
export function getDeviceInfo() {
  if (typeof navigator === 'undefined') return 'Unknown';
  return navigator.userAgent;
}

/**
 * Get friendly device name from user agent
 */
export function getDeviceName(userAgent) {
  if (!userAgent) return 'Unknown Device';
  
  if (/iPhone/i.test(userAgent)) return 'iPhone';
  if (/iPad/i.test(userAgent)) return 'iPad';
  if (/Android/i.test(userAgent)) return 'Android Device';
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Mac/i.test(userAgent)) return 'Mac';
  if (/Linux/i.test(userAgent)) return 'Linux PC';
  if (/Chrome/i.test(userAgent)) return 'Chrome Browser';
  if (/Firefox/i.test(userAgent)) return 'Firefox Browser';
  if (/Safari/i.test(userAgent)) return 'Safari Browser';
  
  return 'Web Browser';
}