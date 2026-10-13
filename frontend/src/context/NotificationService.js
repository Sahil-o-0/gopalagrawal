import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../config';

const isAndroidExpoGo =
  Platform.OS === 'android' &&
  Constants?.appOwnership === 'expo';

let Notifications = null;
if (!isAndroidExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch (e) {
    Notifications = null;
  }
}

/**
 * Schedules a local device alarm/notification.
 */
export async function scheduleLocalComplianceReminder(title, body, triggerSeconds = 5) {
  if (!Notifications) return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#006C49',
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL || 'timeInterval',
        seconds: triggerSeconds,
        channelId: 'default',
      },
    });
  } catch (err) {
    console.log('Local reminder notice:', err.message);
  }
}

/**
 * Register push notifications safely in standalone / development builds.
 */
export async function registerForPushNotificationsAsync(userToken) {
  if (isAndroidExpoGo || !Notifications) {
    return null;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      '49f2af85-52f5-4a74-affe-431ee3daeda6';

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId }).catch(() => null);

    if (!tokenData || !tokenData.data) {
      return null;
    }

    const pushToken = tokenData.data;

    if (userToken) {
      await fetch(`${API_BASE_URL}/auth/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ push_token: pushToken }),
      }).catch(() => {});
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#006C49',
      });
    }

    return pushToken;
  } catch (error) {
    return null;
  }
}

export async function clearPendingLocalNotifications() {
  if (Notifications?.cancelAllScheduledNotificationsAsync) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (_) {}
  }
}

/**
 * Legacy check: cancels any stale local notifications.
 * Background push notifications are handled directly by the server scheduler at 11:00 AM and 4:00 PM IST.
 */
export async function checkAndTriggerAutomatedAlerts(userToken) {
  await clearPendingLocalNotifications();
}
