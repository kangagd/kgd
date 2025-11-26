import { useEffect, useRef } from "react";

const ONESIGNAL_APP_ID = "50b86e27-3335-48dc-877c-4e4f3d223620";

/**
 * OneSignal Initializer Component
 * Uses the exact initialization code from OneSignal dashboard
 * Should be placed in the Layout component
 */
export default function OneSignalInitializer({ user }) {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initialized.current) return;
    initialized.current = true;

    const initOneSignal = async () => {
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

        // Initialize using OneSignal's recommended pattern
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
          try {
            await OneSignal.init({
              appId: ONESIGNAL_APP_ID,
            });
            console.log('[OneSignal] Initialized successfully');

            // If user is logged in, link their account
            if (user?.id) {
              try {
                await OneSignal.login(user.id);
                console.log('[OneSignal] User logged in:', user.id);
                
                if (user.email) {
                  await OneSignal.User.addEmail(user.email);
                }
                
                await OneSignal.User.addTags({
                  email: user.email || '',
                  role: user.role || 'user',
                  is_technician: user.is_field_technician ? 'true' : 'false'
                });
              } catch (loginError) {
                console.error('[OneSignal] Login error:', loginError);
              }
            }
          } catch (initError) {
            console.error('[OneSignal] Init error:', initError);
          }
        });
      } catch (error) {
        console.error('[OneSignal] Failed to load SDK:', error);
      }
    };

    initOneSignal();
  }, [user?.id, user?.email, user?.role, user?.is_field_technician]);

  return null;
}