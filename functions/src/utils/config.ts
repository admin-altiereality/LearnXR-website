/**
 * Configuration utilities
 * Handles secrets and environment variables
 */

// Helper function to clean secrets (remove whitespace, newlines, etc.)
const cleanSecret = (secret: string): string => {
  if (!secret) return '';
  // Remove all whitespace, newlines, carriage returns, and trim
  return secret.trim().replace(/\r\n/g, '').replace(/\n/g, '').replace(/\r/g, '').trim();
};

// Get secrets from environment variables only
export const getSecret = (name: string): string => {
  const value = process.env[name] || '';
  // Clean the secret to remove any accidental newlines or whitespace
  return cleanSecret(value);
};
