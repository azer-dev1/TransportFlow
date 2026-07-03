import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Show pushes as banners even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for permission, fetch the Expo push token, and register it in
 * `devices` (RLS: owner-only). Quietly a no-op where push can't work:
 * simulators/emulators, Expo Go on Android (SDK 53+ removed remote push),
 * or when no EAS projectId is configured yet.
 */
async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) {
    console.log('push: skipped (not a physical device)');
    return;
  }

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.log('push: skipped (no EAS projectId configured yet)');
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } =
    existing === 'granted' ? { status: existing } : await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('push: permission not granted');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Trip updates',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase
      .from('devices')
      .upsert(
        { user_id: userId, expo_push_token: token },
        { onConflict: 'user_id,expo_push_token', ignoreDuplicates: true },
      );
    if (error) console.warn('push: device registration failed:', error.message);
  } catch (err) {
    // e.g. Expo Go on Android, missing FCM credentials in a bare dev build
    console.warn('push: token unavailable:', err);
  }
}

/**
 * Mount once for a signed-in user: registers the device token and routes
 * notification taps to the trip they concern (the Edge Function puts
 * trip_id in the push payload's data).
 */
export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    registerPushToken(userId);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const tripId = response.notification.request.content.data?.trip_id;
      if (typeof tripId === 'string') router.push(`/trips/${tripId}`);
    });
    return () => sub.remove();
  }, [userId]);
}
