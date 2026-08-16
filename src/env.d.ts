/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Amazon Associates tracking tag. Unset until the account is approved
   * (needs live content first) — see src/lib/affiliateLinks.ts. */
  readonly PUBLIC_AMAZON_ASSOCIATES_TAG?: string;
  /** Cloudflare Turnstile site key (public by design, unlike the secret key,
   * which lives only in the Apps Script project's Script Properties). */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** The deployed Google Apps Script Web App /exec URL that receives lead
   * submissions. See scripts/apps-script/README.md. */
  readonly PUBLIC_LEAD_CAPTURE_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
