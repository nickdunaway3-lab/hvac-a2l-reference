/** Lowercase, dash-separated, URL-safe slug. Model numbers contain
 * characters like "**" (e.g. "ML13KC1-060-230A**") that are technically
 * legal in a URL path but ugly and fragile for a "readable and stable" URL
 * -- stripped here. The original raw string is still what's rendered as
 * page content (H1, title), just not what's in the URL. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
