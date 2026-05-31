import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REMINDER_ID_KEY = "daily_reminder_notification_id";
const TRIAL_ID_KEY = "trial_ending_notification_id";

// Show notifications while the app is foregrounded too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Ask for permission (returns true if granted). Safe to call repeatedly. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === "granted") return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted || req.status === "granted";
  } catch {
    return false;
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted || current.status === "granted";
  } catch {
    return false;
  }
}

/** Schedule a repeating daily local reminder (cancels any previous one). */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  title: string,
  body: string
): Promise<boolean> {
  try {
    await cancelDailyReminder();
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(REMINDER_ID_KEY, id);
    return true;
  } catch {
    return false;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(REMINDER_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(REMINDER_ID_KEY);
    }
  } catch {
    // ignore
  }
}

/** Schedule a one-off reminder 24h before a trial/subscription expires. */
export async function scheduleTrialEndingReminder(
  expiresAt: Date,
  title: string,
  body: string
): Promise<boolean> {
  try {
    await cancelTrialEndingReminder();
    const fireAt = new Date(expiresAt.getTime() - 24 * 60 * 60 * 1000);
    if (fireAt.getTime() <= Date.now()) return false; // expiry is too soon / past
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    await AsyncStorage.setItem(TRIAL_ID_KEY, id);
    return true;
  } catch {
    return false;
  }
}

export async function cancelTrialEndingReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(TRIAL_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(TRIAL_ID_KEY);
    }
  } catch {
    // ignore
  }
}
