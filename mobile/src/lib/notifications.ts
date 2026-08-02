import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Expo Go has no remote-push support (removed on Android in SDK 53+), and
// initializing expo-notifications there can crash outright — leave the
// module completely untouched unless we're in a real build.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

/**
 * Android channel carrying every push we send. Channels are immutable after
 * creation (only name/description can change), so fixing the settings means
 * a NEW id — the old 'default' channel below shipped with vibration off and
 * could never be repaired in place. Bump the suffix if these ever change again.
 */
export const ANDROID_CHANNEL_ID = 'trip-updates-v2';

if (!isExpoGo) {
  // Show pushes as banners even while the app is foregrounded.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      // Must stay true for foreground pushes to vibrate: expo-notifications
      // derives *both* sound and vibration from this one flag, and when both
      // come out false it calls setSilent(true) on the notification, which
      // overrides the channel. With it false, a foregrounded push was
      // completely silent — no sound, no buzz.
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

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
    // enableVibrate/vibrationPattern are NOT on by default for a channel
    // created this way, and the old 'default' channel set neither — which is
    // why pushes never buzzed. The Edge Function targets this id explicitly;
    // without a channelId in the payload the OS falls back to Expo's own
    // "Miscellaneous" channel and our settings here are ignored entirely.
    // No `sound` key on purpose. It names a custom sound *resource* bundled in
    // the app, not a mode — passing 'default' made expo-notifications hunt for
    // a raw resource called "default" and log "Custom sound 'default' not found
    // in native app". Omitting it leaves the channel on Android's own default
    // notification sound, which is what we wanted.
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Trip updates',
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: true,
      vibrationPattern: [0, 250, 250, 250],
    });
    // Tidy up dead predecessors so users don't see duplicates in Android's
    // per-channel notification settings. 'trip-updates-v1' shipped with the
    // bad sound key and can't be repaired in place — channels are immutable.
    await Notifications.deleteNotificationChannelAsync('default');
    await Notifications.deleteNotificationChannelAsync('trip-updates-v1');
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
    if (!userId || isExpoGo) return;

    registerPushToken(userId);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const { trip_id: tripId, line_id: lineId } = response.notification.request.content.data ?? {};
      if (typeof tripId === 'string') router.push(`/trips/${tripId}`);
      else if (typeof lineId === 'string') router.push(`/lines/${lineId}`); // service alerts
    });
    return () => sub.remove();
  }, [userId]);
}
