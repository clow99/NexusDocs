import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with Tailwind CSS conflict resolution
 * @param {...(string|undefined|null|false)} inputs - Class names to merge
 * @returns {string} Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date to a human-readable string
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  const defaultOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  };
  return new Intl.DateTimeFormat("en-US", defaultOptions).format(
    new Date(date)
  );
}

/**
 * Format a relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date, { month: "short", day: "numeric" });
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate a random ID
 * @returns {string} Random ID
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if we're in mock mode
 * @returns {boolean} True if mock mode is enabled
 */
export function isMockMode() {
  return process.env.NEXT_PUBLIC_MOCK_MODE === "true";
}

/**
 * Get status color class based on status string
 * @param {string} status - Status string
 * @returns {string} Tailwind color class
 */
export function getStatusColor(status) {
  const statusColors = {
    connected: "text-green-600 dark:text-green-400",
    disconnected: "text-muted-foreground",
    error: "text-red-600 dark:text-red-400",
    pending: "text-yellow-600 dark:text-yellow-400",
    approved: "text-green-600 dark:text-green-400",
    rejected: "text-red-600 dark:text-red-400",
    published: "text-blue-600 dark:text-blue-400",
    running: "text-blue-600 dark:text-blue-400",
    queued: "text-yellow-600 dark:text-yellow-400",
    succeeded: "text-green-600 dark:text-green-400",
    failed: "text-red-600 dark:text-red-400",
  };
  return statusColors[status?.toLowerCase()] || "text-muted-foreground";
}

/**
 * Get status badge variant based on status string
 * @param {string} status - Status string
 * @returns {string} Badge variant
 */
export function getStatusVariant(status) {
  const statusVariants = {
    connected: "success",
    disconnected: "secondary",
    error: "destructive",
    pending: "warning",
    approved: "success",
    rejected: "destructive",
    published: "default",
    running: "default",
    queued: "warning",
    succeeded: "success",
    failed: "destructive",
  };
  return statusVariants[status?.toLowerCase()] || "secondary";
}
