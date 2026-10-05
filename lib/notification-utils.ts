/**
 * Shared notification utility helpers.
 *
 * Extracted from app/api/cron/heat-risk-dispatch/route.ts so that the route
 * file only exposes valid Next.js Route Handler exports (GET, POST, dynamic,
 * etc.) and does not accidentally export arbitrary functions that confuse the
 * Next.js Route type checker.
 */

/**
 * Checks whether the current instant falls within the user's configured quiet
 * hours, evaluating time in the user's specific local timezone.
 *
 * Supports both daytime windows (e.g. 13:00–15:00) and overnight windows
 * (e.g. 22:00–07:00).
 */
export function isWithinQuietHours(
  quietHours?: { enabled: boolean; start: string; end: string },
  timezone?: string
): boolean {
  if (!quietHours || !quietHours.enabled) return false;
  if (!quietHours.start || !quietHours.end) return false;

  try {
    const tz = timezone || 'Asia/Kolkata';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour')?.value || '00';
    const minutePart = parts.find((p) => p.type === 'minute')?.value || '00';
    const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minutePart, 10);

    const [startH, startM] = quietHours.start.split(':').map((s) => parseInt(s, 10));
    const [endH, endM] = quietHours.end.split(':').map((s) => parseInt(s, 10));
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    if (startMinutes <= endMinutes) {
      // Daytime quiet window (e.g. 13:00 to 15:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight quiet window (e.g. 22:00 to 07:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}
