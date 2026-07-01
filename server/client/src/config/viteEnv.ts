/**
 * Expose Vite env on window.VITE_ENV for modules that read it at load time.
 * Import this module first in main.jsx (before productionLogger and App).
 */
declare global {
  interface Window {
    VITE_ENV: ImportMetaEnv & {
      readonly PROD: boolean;
      readonly DEV: boolean;
      readonly MODE: string;
    };
  }
}

if (typeof window !== 'undefined') {
  window.VITE_ENV = import.meta.env as Window['VITE_ENV'];
}

export {};
