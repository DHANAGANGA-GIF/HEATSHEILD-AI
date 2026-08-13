export type NotificationPermissionState = 'granted' | 'denied' | 'default';

export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const status = await Notification.requestPermission();
    return status as NotificationPermissionState;
  } catch (err) {
    console.warn('Browser notification permission request error', err);
    return Notification.permission as NotificationPermissionState;
  }
}

export function sendBrowserPushNotification(title: string, options?: NotificationOptions): boolean {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }
  try {
    new Notification(title, {
      icon: '/icon.png',
      badge: '/badge.png',
      ...options,
    });
    return true;
  } catch (err) {
    console.warn('Failed to send browser push notification', err);
    return false;
  }
}
