/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
  /** reCAPTCHA v2 site key for Secret Backend Login (optional) */
  readonly VITE_RECAPTCHA_SITE_KEY?: string
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 