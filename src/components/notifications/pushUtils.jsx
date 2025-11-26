import { base44 } from "@/api/base44Client";

// VAPID public key - single source of truth
export const VAPID_PUBLIC_KEY = "BLBx-hf5h3SAQ5fvT2xMZHy4iNxKbEQKLX8BYWvP4xJPqGLw3Ns-Ks6kZ6nPZKBwLK9nP5ZwXPPkPmz7_P5PQAQ";

/**
 * Convert base64 VAPID key to Uint8Array for pushManager.subscribe()
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported() {
  return 'Notification' in window && 
         'serviceWorker' in navigator && 
         'PushManager' in window;
}

/**
 * Get the current notification permission status
 */
export function getPermissionStatus() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default', 'granted', or 'denied'
}

/**
 * Get a service worker registration with timeout protection
 */
async function getServiceWorkerRegistration(timeoutMs = 5000) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Service worker timeout'));
    }, timeoutMs);

    try {
      // Check for existing registrations first
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      if (registrations.length > 0) {
        console.log('[PushUtils] Found existing service worker');
        clearTimeout(timeout);
        resolve(registrations[0]);
        return;
      }

      // Try to register a new one
      console.log('[PushUtils] Registering new service worker...');
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // Wait for it to be ready
      await navigator.serviceWorker.ready;
      
      clearTimeout(timeout);
      resolve(registration);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * Check if the current device has an active push subscription on the backend
 * Returns the subscription object if found, null otherwise
 */
export async function getActiveSubscriptionForDevice(userId) {
  console.log('[PushUtils] getActiveSubscriptionForDevice called, userId:', userId);
  
  if (!userId) {
    console.log('[PushUtils] No userId provided');
    return null;
  }
  
  if (!isPushSupported()) {
    console.log('[PushUtils] Push not supported');
    return null;
  }

  try {
    // Get service worker with timeout
    let registration;
    try {
      registration = await getServiceWorkerRegistration(5000);
    } catch (swError) {
      console.log('[PushUtils] Service worker not available:', swError.message);
      return null;
    }

    // Get current browser subscription
    const currentSubscription = await registration.pushManager.getSubscription();
    console.log('[PushUtils] Browser subscription:', currentSubscription ? 'exists' : 'none');
    
    if (!currentSubscription) {
      return null;
    }
    
    const currentEndpoint = currentSubscription.endpoint;
    
    // Check backend for matching subscription
    const subscriptions = await base44.entities.PushSubscription.filter({
      user_id: userId,
      platform: 'web',
      active: true
    });
    console.log('[PushUtils] Backend subscriptions count:', subscriptions.length);
    
    const matchingSub = subscriptions.find(s => {
      try {
        const parsed = JSON.parse(s.subscription_json || '{}');
        return parsed.endpoint === currentEndpoint;
      } catch {
        return false;
      }
    });
    
    console.log('[PushUtils] Matching subscription:', matchingSub ? 'found' : 'not found');
    return matchingSub || null;
  } catch (error) {
    console.error('[PushUtils] Error in getActiveSubscriptionForDevice:', error);
    return null;
  }
}

/**
 * Get all active subscriptions for a user
 */
export async function getAllSubscriptionsForUser(userId) {
  if (!userId) return [];
  
  try {
    const subs = await base44.entities.PushSubscription.filter({ 
      user_id: userId,
      active: true 
    });
    return subs;
  } catch (error) {
    console.error('[PushUtils] Error fetching subscriptions:', error);
    return [];
  }
}

/**
 * Main registration function - the single entry point for push notification registration
 * Returns: { success: boolean, message: string, subscription?: object }
 */
export async function registerForPushNotifications(user) {
  console.log('[PushUtils] Starting registration for user:', user?.id);
  
  // Step 1: Check browser support
  if (!isPushSupported()) {
    return { 
      success: false, 
      message: 'Push notifications are not supported in this browser.' 
    };
  }
  
  // Step 2: Check/request permission
  let permission = Notification.permission;
  console.log('[PushUtils] Current permission:', permission);
  
  if (permission === 'denied') {
    return { 
      success: false, 
      message: 'Notifications are blocked. Please enable them in your browser settings and reload the page.' 
    };
  }
  
  if (permission === 'default') {
    console.log('[PushUtils] Requesting permission...');
    try {
      permission = await Notification.requestPermission();
      console.log('[PushUtils] Permission result:', permission);
    } catch (error) {
      console.error('[PushUtils] Permission request error:', error);
      return { 
        success: false, 
        message: 'Failed to request notification permission.' 
      };
    }
    
    if (permission !== 'granted') {
      return { 
        success: false, 
        message: 'Notification permission was not granted.' 
      };
    }
  }
  
  // Step 3: Get service worker registration with timeout
  let registration;
  try {
    registration = await getServiceWorkerRegistration(10000);
    console.log('[PushUtils] Service worker ready');
  } catch (error) {
    console.error('[PushUtils] Service worker error:', error);
    return { 
      success: false, 
      message: 'Service worker not available. Please reload the page and try again.' 
    };
  }
  
  // Step 4: Get or create push subscription
  let subscription;
  try {
    subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[PushUtils] Creating new push subscription...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    console.log('[PushUtils] Push subscription obtained');
  } catch (error) {
    console.error('[PushUtils] PushManager error:', error);
    return { 
      success: false, 
      message: 'Failed to create push subscription: ' + (error.message || 'Unknown error') 
    };
  }
  
  // Step 5: Save to backend
  try {
    const subscriptionJson = JSON.stringify(subscription.toJSON());
    const deviceInfo = navigator.userAgent;
    const now = new Date().toISOString();
    
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
    
    let savedSubscription;
    if (existingWithSameEndpoint) {
      console.log('[PushUtils] Updating existing subscription');
      await base44.entities.PushSubscription.update(existingWithSameEndpoint.id, {
        active: true,
        last_seen: now,
        subscription_json: subscriptionJson,
        device_info: deviceInfo
      });
      savedSubscription = { ...existingWithSameEndpoint, active: true, last_seen: now };
    } else {
      console.log('[PushUtils] Creating new subscription record');
      savedSubscription = await base44.entities.PushSubscription.create({
        user_id: user.id,
        user_email: user.email,
        platform: 'web',
        subscription_json: subscriptionJson,
        active: true,
        last_seen: now,
        device_info: deviceInfo
      });
    }
    
    console.log('[PushUtils] Registration complete');
    return { 
      success: true, 
      message: 'Push notifications enabled!',
      subscription: savedSubscription
    };
  } catch (error) {
    console.error('[PushUtils] Backend save error:', error);
    return { 
      success: false, 
      message: 'Failed to save subscription. Please try again.' 
    };
  }
}

/**
 * Disable a specific subscription
 */
export async function disableSubscription(subscriptionId) {
  try {
    await base44.entities.PushSubscription.update(subscriptionId, { active: false });
    return { success: true };
  } catch (error) {
    console.error('[PushUtils] Failed to disable subscription:', error);
    return { success: false, message: 'Failed to remove device' };
  }
}

/**
 * Get friendly device name from user agent
 */
export function getDeviceName(deviceInfo) {
  if (!deviceInfo) return 'Unknown Device';
  if (deviceInfo.includes('iPhone')) return 'iPhone';
  if (deviceInfo.includes('iPad')) return 'iPad';
  if (deviceInfo.includes('Android')) return 'Android';
  if (deviceInfo.includes('Mac')) return 'Mac';
  if (deviceInfo.includes('Windows')) return 'Windows PC';
  if (deviceInfo.includes('Linux')) return 'Linux';
  return 'Web Browser';
}

/**
 * Check if a subscription matches the current device
 */
export function isCurrentDevice(sub) {
  if (!sub?.device_info) return false;
  return navigator.userAgent === sub.device_info;
}