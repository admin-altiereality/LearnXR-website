/**
 * Theme hook: dark/light mode with localStorage.
 * Uses ThemeContext when available so the toggle works across all pages.
 * Applies class "light" on document.documentElement for light mode (index.css .light variables).
 */

import { useThemeContext } from '../contexts/ThemeContext';

export function useTheme() {
  return useThemeContext();
}
