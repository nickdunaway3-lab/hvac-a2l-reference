/**
 * Centralized affiliate-tag configuration. Every network reads its tag/ID
 * from a build-time environment variable — never hardcoded, never a
 * plausible-looking placeholder. Until an account is actually approved and
 * its real env var is set, `buildUrl` returns null and
 * <AffiliateLink /> simply declines to render a link rather than shipping
 * one that's untagged or, worse, looks live but isn't. See DECISIONS.md.
 */

export interface AffiliateNetwork {
  id: string;
  label: string;
  /** Returns the tagged outbound URL, or null if this network isn't configured yet. */
  buildUrl: (destination: string) => string | null;
}

const amazonTag = import.meta.env.PUBLIC_AMAZON_ASSOCIATES_TAG as string | undefined;
// A full tracked-link URL template from whatever network RepairClinic's
// affiliate program runs on (CJ/ShareASale/Impact/etc.), containing the
// literal token "{query}" where the part number should be inserted. Left
// unset until that program is actually joined -- see DECISIONS.md.
const repairClinicTemplate = import.meta.env.PUBLIC_REPAIRCLINIC_AFFILIATE_URL_TEMPLATE as
  | string
  | undefined;

export const networks = {
  /** destination: an ASIN, e.g. "B0ABCD1234" */
  amazon: {
    id: "amazon",
    label: "Amazon",
    buildUrl: (asin: string) =>
      amazonTag ? `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(amazonTag)}` : null,
  },
  /** destination: a part number, e.g. "CONT1P030024V" */
  repairclinic: {
    id: "repairclinic",
    label: "RepairClinic",
    buildUrl: (partNumber: string) =>
      repairClinicTemplate
        ? repairClinicTemplate.replace("{query}", encodeURIComponent(partNumber))
        : null,
  },
} satisfies Record<string, AffiliateNetwork>;

export type NetworkId = keyof typeof networks;
