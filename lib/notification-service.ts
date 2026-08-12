/**
 * HeatShield AI — Browser Notification Service (Phase 10)
 *
 * Real browser Push & Desktop Notification Manager.
 * Uses native Web Notification API (window.Notification).
 */

import { SmartAlert } from './types';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Get current browser notification permission status.
 */
export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * Request notification permission from browser.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionState;
  } catch (e) {
    console.warn('Failed to request notification permission:', e);
    return Notification.permission as NotificationPermissionState;
  }
}

/**
 * Send a real browser push notification for a SmartAlert.
 */
export function sendBrowserNotification(
  alert: SmartAlert,
  options?: { deepLinkUrl?: string }
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const deepLink = options?.deepLinkUrl || `/notifications?id=${alert.id}`;
    const icon = '/favicon.ico';
    const tag = alert.dedup_key || alert.id;

    const notification = new Notification(alert.title, {
      body: alert.message,
      icon,
      tag,
      data: { url: deepLink, alertId: alert.id },
      requireInteraction: alert.priority === 'CRITICAL' || alert.priority === 'HIGH PRIORITY',
    });

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options?.deepLinkUrl) {
        window.location.href = options.deepLinkUrl;
      } else {
        window.location.href = deepLink;
      }
    };

    return true;
  } catch (e) {
    console.warn('Error displaying browser notification:', e);
    return false;
  }
}
