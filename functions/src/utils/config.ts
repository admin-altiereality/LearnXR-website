/**
 * Configuration utilities
 * Handles secrets and environment variables
 */

// Get secrets from environment variables only
export const getSecret = (name: string): string => {
  return process.env[name] || '';
};

