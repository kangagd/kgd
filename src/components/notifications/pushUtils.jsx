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
 * Check if the current device has an active push subscription on the backend
 */
export async function getActiveSubscriptionForDevice(userId) {
  console.log('[PushUtils] getActiveSubscriptionForDevice called, userId:', userId);
  
  if (!userId || !isPushSupported()) {
    console.log('[PushUtils] Early return - userId:', userId, 'isPushSupported:', isPushSupported());
    return null;
  }
  
  try {
    // Get current browser's push subscription endpoint
    console.log('[PushUtils] Waiting for service worker ready...');
    const registration = await navigator.serviceWorker.ready;
    console.log('[PushUtils] Service worker ready, getting subscription...');
    
    const currentSubscription = await registration.pushManager.getSubscription();
    console.log('[PushUtils] Current push subscription:', currentSubscription);
    
    if (!currentSubscription) {
      console.log('[PushUtils] No current push subscription in browser');
      return null;
    }
    
    const currentEndpoint = currentSubscription.endpoint;
    console.log('[PushUtils] Current endpoint:', currentEndpoint);
    
    // Check backend for matching subscription
    console.log('[PushUtils] Fetching backend subscriptions...');
    const subscriptions = await base44.entities.PushSubscription.filter({
      user_id: userId,
      platform: 'web',
      active: true
    });
    console.log('[PushUtils] Backend subscriptions:', subscriptions);
    
    const matchingSub = subscriptions.find(s => {
      try {
        const parsed = JSON.parse(s.subscription_json || '{}');
        const matches = parsed.endpoint === currentEndpoint;
        console.log('[PushUtils] Comparing endpoints:', { backend: parsed.endpoint, current: currentEndpoint, matches });
        return matches;
      } catch (e) {
        console.log('[PushUtils] Error parsing subscription_json:', e);
        return false;
      }
    });
    
    console.log('[PushUtils] Matching subscription found:', matchingSub);
    return matchingSub || null;
  } catch (error) {
    console.error('[PushUtils] Error checking active subscription:', error);
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
  console.log('[PushUtils] Starting push notification registration...');
  
  // Step 1: Check browser support
  if (!isPushSupported()) {
    console.log('[PushUtils] Push not supported in this browser');
    return { 
      success: false, 
      message: 'Push notifications are not supported in this browser.' 
    };
  }
  
  // Step 2: Check/request permission
  let permission = Notification.permission;
  console.log('[PushUtils] Current permission:', permission);
  
  if (permission === 'denied') {
    console.log('[PushUtils] Permission denied by user');
    return { 
      success: false, 
      message: 'Notifications are blocked. Please enable them in your browser/device settings and reload the page.' 
    };
  }
  
  if (permission === 'default') {
    console.log('[PushUtils] Requesting permission...');
    permission = await Notification.requestPermission();
    console.log('[PushUtils] Permission result:', permission);
    
    if (permission !== 'granted') {
      return { 
        success: false, 
        message: 'Notification permission was not granted.' 
      };
    }
  }
  
  // Step 3: Ensure service worker registration
  let registration;
  try {
    console.log('[PushUtils] Checking for existing service worker...');
    
    // First try to get existing registrations
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    if (registrations.length > 0) {
      console.log('[PushUtils] Found existing service worker registration');
      registration = registrations[0];
    } else {
      // No existing registration, try to register one
      console.log('[PushUtils] No service worker found, attempting to register...');
      registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[PushUtils] Service worker registered');
    }
    
    // Wait for it to be ready
    await navigator.serviceWorker.ready;
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
    console.error('[PushUtils] PushManager subscription error:', error);
    return { 
      success: false, 
      message: 'Failed to subscribe to push notifications: ' + (error.message || 'Unknown error') 
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
      console.log('[PushUtils] Updating existing subscription:', existingWithSameEndpoint.id);
      await base44.entities.PushSubscription.update(existingWithSameEndpoint.id, {
        active: true,
        last_seen: now,
        subscription_json: subscriptionJson,
        device_info: deviceInfo
      });
      savedSubscription = { ...existingWithSameEndpoint, active: true, last_seen: now };
    } else {
      console.log('[PushUtils] Creating new subscription record...');
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
    
    console.log('[PushUtils] Registration successful');
    return { 
      success: true, 
      message: 'Push notifications enabled successfully!',
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
    console.log('[PushUtils] Subscription disabled:', subscriptionId);
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