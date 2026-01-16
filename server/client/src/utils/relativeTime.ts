/**
 * Relative Time Formatting Utility
 * Formats dates as "2 hours ago", "3 days ago", etc.
 */

/**
 * Format a date string or Date object as relative time
 * @param dateString - ISO date string or Date object
 * @returns Formatted relative time string (e.g., "2 hours ago", "3 days ago", "Never")
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return 'Never';
  }

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // If date is in the future, return "Just now"
    if (diffMs < 0) {
      return 'Just now';
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    // Less than 1 minute
    if (diffSeconds < 60) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }

    // Less than 24 hours
    if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }

    // Less than 7 days
    if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }

    // Less than 4 weeks
    if (diffWeeks < 4) {
      return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
    }

    // Less than 12 months
    if (diffMonths < 12) {
      return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    }

    // Years
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Invalid date';
  }
}

/**
 * Format a date with fallback to relative time if recent
 * @param dateString - ISO date string or Date object
 * @param showRelativeIfRecent - Show relative time if less than 7 days old
 * @returns Formatted date string
 */
export function formatDateWithRelative(
  dateString: string | null | undefined,
  showRelativeIfRecent: boolean = true
): string {
  if (!dateString) {
    return 'Never';
  }

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // If recent and showRelativeIfRecent is true, use relative time
    if (showRelativeIfRecent && diffDays < 7) {
      return formatRelativeTime(dateString);
    }

    // Otherwise, use formatted date
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: diffDays < 365 ? undefined : 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}
