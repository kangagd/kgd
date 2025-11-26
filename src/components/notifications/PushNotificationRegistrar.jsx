import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// VAPID public key from environment
const VAPID_PUBLIC_KEY = "BLBx-hf5h3SAQ5fvT2xMZHy4iNxKbEQKLX8BYWvP4xJPqGLw3Ns-Ks6kZ6nPZKBwLK9nP5ZwXPPkPmz7_P5PQAQ";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationRegistrar({ user }) {
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!user || hasRegistered.current) return;
    
    const registerPushSubscription = async () => {
      // Check if browser supports notifications and service workers
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported in this browser');
        return;
      }

      // Check current permission
      if (Notification.permission === 'denied') {
        console.log('Push notifications denied by user');
        return;
      }

      try {
        // Request permission if not granted
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.log('Push notification permission not granted');
            return;
          }
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();

        // If no subscription, create one
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        }

        // Convert subscription to JSON string
        const subscriptionJson = JSON.stringify(subscription.toJSON());
        const deviceInfo = navigator.userAgent;

        // Check if we already have a subscription for this user/endpoint
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
          // Update last_seen
          await base44.entities.PushSubscription.update(existingWithSameEndpoint.id, {
            active: true,
            last_seen: new Date().toISOString(),
            subscription_json: subscriptionJson,
            device_info: deviceInfo
          });
        } else {
          // Create new subscription record
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

        hasRegistered.current = true;
        console.log('Push subscription registered successfully');
      } catch (error) {
        console.error('Failed to register push subscription:', error);
      }
    };

    registerPushSubscription();
  }, [user]);

  // This component renders nothing - it just handles registration
  return null;
}