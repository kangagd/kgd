/**
 * Technician Display Utility
 * Single source of truth for displaying technician names across the app.
 * Always prioritizes User.display_name.
 */

export interface User {
  id?: string;
  email?: string;
  display_name?: string;
  full_name?: string;
}

/**
 * Resolve technician display name with strict fallback hierarchy.
 * @param user - User object
 * @returns Display name or 'Unknown' if invalid
 */
export function resolveTechnicianDisplayName(user: any): string {
  if (!user) return 'Unknown';

  // Primary: display_name (must be non-empty)
  if (typeof user.display_name === 'string' && user.display_name.trim()) {
    return user.display_name.trim();
  }

  // Safety fallback only (indicates data issue)
  if (user.full_name && typeof user.full_name === 'string') {
    return user.full_name.trim();
  }

  // Last resort: email prefix
  if (user.email && typeof user.email === 'string') {
    return user.email.split('@')[0];
  }

  return 'Unknown';
}

/**
 * Generate initials from display name for avatar rendering.
 * @param displayName - Display name string
 * @returns Two-character initials or '?'
 */
export function getInitialsFromDisplayName(displayName: string): string {
  if (!displayName || typeof displayName !== 'string') return '?';

  const trimmed = displayName.trim();
  if (!trimmed) return '?';

  const parts = trimmed.split(' ').filter(p => p);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}