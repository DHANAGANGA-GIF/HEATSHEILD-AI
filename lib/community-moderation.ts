import { CommunityCategory, CommunityReport } from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedDescription?: string;
}

/**
 * Validates latitude and longitude values to ensure they fall within acceptable geographical ranges.
 */
export function validateCoordinates(lat: number, lon: number): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  // Reject exact 0,0 unless specifically intended
  if (lat === 0 && lon === 0) return false;
  return true;
}

/**
 * Strips HTML tags and script content to sanitize user input against XSS attacks.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Validates a community report submission against length, category, and coordinate rules.
 */
export function validateReportInput(
  category: string,
  description: string,
  lat: number,
  lon: number
): ValidationResult {
  const allowedCategories: string[] = [
    'water_access',
    'shade_cooling',
    'outdoor_heat',
    'cooling_facility',
    'unsafe_condition',
    'infrastructure',
    'public_space',
    'other',
  ];

  if (!allowedCategories.includes(category)) {
    return { valid: false, error: 'Invalid report category.' };
  }

  if (!description || typeof description !== 'string') {
    return { valid: false, error: 'Report description is required.' };
  }

  const sanitized = sanitizeHtml(description);
  if (sanitized.length < 5) {
    return { valid: false, error: 'Report description must be at least 5 characters long.' };
  }

  if (sanitized.length > 1000) {
    return { valid: false, error: 'Report description exceeds maximum length of 1000 characters.' };
  }

  if (!validateCoordinates(lat, lon)) {
    return { valid: false, error: 'Invalid latitude or longitude coordinates.' };
  }

  return {
    valid: true,
    sanitizedDescription: sanitized,
  };
}

// In-memory submission tracking for rapid duplicate submission prevention
const lastSubmissionMap = new Map<string, number>();

/**
 * Checks if a user is attempting rapid duplicate submissions within a cooldown window.
 */
export function checkDuplicateSubmission(
  userId: string,
  description: string,
  existingReports: CommunityReport[],
  cooldownSeconds: number = 30
): { isDuplicate: boolean; reason?: string } {
  const now = Date.now();

  // Rapid submission rate limit per user ID
  if (userId) {
    const lastTime = lastSubmissionMap.get(userId);
    if (lastTime && now - lastTime < cooldownSeconds * 1000) {
      const waitTime = Math.ceil((cooldownSeconds * 1000 - (now - lastTime)) / 1000);
      return {
        isDuplicate: true,
        reason: `Please wait ${waitTime} seconds before submitting another report.`,
      };
    }
  }

  // Check exact description duplicate within past 5 minutes
  const recentDuplicate = existingReports.find((r) => {
    const isSameContent = r.description.trim().toLowerCase() === description.trim().toLowerCase();
    const isRecent = now - new Date(r.timestamp).getTime() < 300 * 1000;
    return isSameContent && isRecent;
  });

  if (recentDuplicate) {
    return {
      isDuplicate: true,
      reason: 'A duplicate report with similar details was recently submitted.',
    };
  }

  return { isDuplicate: false };
}

/**
 * Records the timestamp of a successful submission for cooldown enforcement.
 */
export function recordSubmissionTime(userId: string): void {
  if (userId) {
    lastSubmissionMap.set(userId, Date.now());
  }
}

/**
 * Clears the submission tracking map (primarily for test resets).
 */
export function clearSubmissionTracker(): void {
  lastSubmissionMap.clear();
}
