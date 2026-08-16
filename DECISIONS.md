# Decisions

A running log of *why*, not just *what*, so this project can be picked up cold.
Newest entries at the bottom.

## 2026-08-16 — Project framing

- **Goal**: sourced, structured reference site on the HVAC A2L refrigerant
  transition (R-410A → R-454B/R-32). Not a blog. The moat is that every value
  is traceable to a real source — nothing is inferred, interpolated, or
  guessed. See the schema rule below.
- **Hard constraints**: $0 running cost, fully static output, Cloudflare
  Pages + GitHub Actions free tiers, roughly monthly rebuild cadence, one
  non-HVAC-professional operator who cannot eyeball-verify a spec.
- **Scope for the initial build**: the five core content areas only
  (equipment matching, line set reuse, leak detection, state/local code
  adoption, R-410A availability). Adjacent niches (heat pump water heaters,
  electrification rebates, EV chargers/electrical panels) were discussed and
  deliberately deferred — the schema and ingestion pattern are generic enough
  that adding a new content area or a second vertical later is additive, not
  a rework. Not started now, to keep the initial build shippable.

## Phase 1 feasibility findings (informing everything below)

- **AHRI Directory of Certified Product Performance**: its terms of use
  explicitly prohibit downloading, entering into a database, or republishing
  its data outside "individual, non-commercial, personal reference." No free
  bulk API — only a paid Data Subscription Program. **We do not scrape or
  reproduce AHRI Directory data.** Equipment-matching data instead comes from
  manufacturer/distributor-published match-up documents, with AHRI reference
  numbers cited as pointers and a link out to AHRI's own public search for
  self-verification (see `ProvenanceBadge.astro`).
- **EPA installation deadline**: the Jan 1, 2026 installation deadline for
  legacy R-410A systems (mfg./imported before Jan 1, 2025) was **removed** by
  an EPA final rule on May 21, 2026. The Jan 1, 2025 *manufacturing*
  prohibition on new R-410A components stands. This corrects the original
  project brief's assumption and is exactly the kind of stale-fact confusion
  this site should clear up.
- **Federal 25C/25D tax credits**: repealed for property placed in service
  after Dec 31, 2025 (OBBBA, signed July 4, 2025). Any future
  rebate/incentive content must reflect this, not the pre-2026 credit
  landscape that's still widely (and incorrectly) referenced online.
- **State/local code adoption**: fragmented across 50 non-uniform sources
  with no feed, and inferring "is A2L installation legal here" from a code
  edition is not something the schema will do — see the field-level decision
  below. Scoped down to edition + source link only.
- **Leak detection thresholds**: trace back to UL 60335-2-40, a paid,
  copyrighted standard — do not source charge thresholds from the standard
  text or from secondary blog summaries (two "reputable" sources gave two
  different numbers during Phase 1 research). Source per-model thresholds
  from each manufacturer's own installation manual instead.

## Monetization architecture (three tracks, running concurrently)

1. **Owned lead capture** (homeowner CTA → Cloudflare Turnstile → a Google
   Apps Script Web App → a Google Sheet). Chosen over Formspree (50
   submissions/month free) or Web3Forms (250/month free) because Apps
   Script's real ceiling (~90 min of script execution/day on a consumer
   account) is effectively unlimited for this traffic scale, the data is
   fully owned/exportable, and it satisfies "no server we run" because
   Google hosts the execution, not us. Not yet implemented — next up.
2. **Affiliate network handoff** (Modernize first choice — explicit free
   signup, transparent pay-per-lead terms, covers HVAC; Networx and
   Angi/HomeAdvisor via Commission Junction as backups, with the caveat that
   HomeAdvisor was subject to a 2023 FTC order over lead-quality marketing).
   Gated on actually having live content — these networks review real sites,
   not empty ones — so this is applied for once the site has real pages, not
   before.
3. **Product affiliate links** (Amazon Associates, ~3% in the
   tools/home-improvement category since a 2020 rate cut — not high, but the
   technician traffic this monetizes was previously written off as
   near-zero-revenue). FTC disclosure is built into the shared page template,
   not left as a per-page reminder, because 16 CFR Part 255 requires the
   disclosure near the link, not buried in a footer.

## Schema and provenance

- Every content collection embeds five shared fields (`src/content.config.ts`,
  `provenanceFields`): `source_url` (required, must be a valid URL),
  `source_type`, `retrieved_at`, `confidence` (`verified` | `needs_review`),
  and an optional free-text `notes`. This is enforced by Zod at build time —
  Astro's content collections throw on schema mismatch, which is the
  "fails the build on a missing source_url" requirement satisfied natively,
  no separate validation script needed.
- Ingestion batches are hand/script-authored YAML files under
  `src/data/sources/<collection>/`, one file per source document actually
  retrieved, with a `document:` block (shared provenance defaults) and a
  `records:` array (the actual rows, which can override any document-level
  field). A custom loader (`src/lib/sourcedBatchLoader.ts`) reads these,
  merges document defaults into each record, and — critically — **throws a
  build error if a batch has no `document.source_url` at all**, before Zod
  even runs. Verified this actually fails the build (not just "should"),
  see the 2026-08-16 pilot entry below.
- `source_type` includes `distributor_compiled_reference` as its own value,
  distinct from `manufacturer_pdf`/`manufacturer_web`. This distinction
  matters: a distributor's compiled matchup chart is not the same evidentiary
  weight as the manufacturer's own document, even though both might look
  like "a PDF with a table in it."
- `stateCodeAdoption` deliberately has no boolean "is A2L allowed" field.
  Only `state`, `code_type`, `edition_adopted`, and an optional
  `adopted_effective_date` — i.e., facts a state's own code agency actually
  publishes. Whether A2L installation is permitted is an inference from that
  fact plus local amendments this site is not positioned to make reliably;
  computing it would violate the "never infer a spec value" rule as surely
  as inventing a SEER number would.
- `refrigerant` on `equipmentMatches` is optional and left unset unless a
  source explicitly states it per model. Brand-level general knowledge
  ("Goodman uses R-32") is not a substitute for a model-specific source —
  demonstrated in the first ingestion batch, where it's omitted throughout
  because the source document had no refrigerant column.

## Pilot ingestion: Goodman GSXN4 + Daikin DX17VSS80 (2026-08-16)

- Source: a distributor-hosted (supplyhouse.com) "Quick Reference Guide" PDF
  covering both Goodman and Daikin Fit matchups. Retrieved directly, 27
  records transcribed verbatim (14 Goodman GSXN4, 13 Daikin DX17VSS80).
- All 27 records set `confidence: needs_review` — this is a distributor
  compilation, not a primary source, and none of it has been individually
  cross-checked against AHRI's own lookup yet.
- Two real data-quality problems surfaced during transcription and were
  **flagged, not silently corrected**:
  - `DX17VSS301`'s second (horizontal-coil) AHRI reference number is simply
    absent from the source. No record was created for that pairing rather
    than guessing a number.
  - `DX17VSS361`'s upflow-coil row repeats the exact AHRI reference number
    used three rows earlier for `DX17VSS301` — almost certainly a
    transcription error in the source PDF, since AHRI numbers should be
    unique per matched combination. Recorded as printed, flagged in `notes`.
  - A likely model-number typo (`CAAPE4860C4` vs. the `CAPE4860C4` pattern
    used everywhere else in the document) was also recorded as printed and
    flagged, not corrected.
  - This is the `needs_review` pathway working as intended on real, messy
    source data, not a hypothetical.
- The provenance verify-link deliberately does **not** deep-link to a
  specific AHRI record: no reliable, confirmed URL pattern for
  reference-number lookups on ahridirectory.org was found during a check
  before shipping. It links to the general public search page with
  instructions instead, rather than shipping an unverified guessed URL.

## Affiliate-link infrastructure (2026-08-16)

- No affiliate accounts are approved yet (Amazon Associates, Modernize, etc.
  all require live content to review first — see the Phase 1 monetization
  notes above). Built the infrastructure anyway, wired to nothing real yet,
  same discipline as the empty content collections: `src/lib/affiliateLinks.ts`
  reads each network's tag from a build-time env var
  (e.g. `PUBLIC_AMAZON_ASSOCIATES_TAG`) and returns `null` if unset.
  `<AffiliateLink>` renders plain text instead of a link when that happens —
  it will never ship a fake, untagged, or guessed affiliate URL.
- `<AffiliateDisclosure>` is FTC-required (16 CFR Part 255) copy, wired into
  `Base.astro` behind a `hasAffiliateLinks` prop so it only appears on pages
  that actually have affiliate links — a disclosure everywhere would dilute
  the ones that matter.
- Not attached to any page yet. The equipment-matching page has no natural
  product tie-in (it's a lookup, not a purchase moment) — forcing an
  affiliate link onto it would be exactly the kind of monetization-first
  design this project is trying to avoid. This will get used for real once
  content like leak-detection sensors or line-set flush kits exists, and
  once real affiliate tags exist to configure.

## Tooling

- Node.js LTS and GitHub CLI were not present on this machine; installed via
  `winget` (both free, standard, uninstallable dev tools).
- Astro, minimal template, TypeScript strict, static output. Telemetry
  disabled.
- GitHub repo created **public** specifically because GitHub Actions minutes
  are free/unmetered on public repos, vs. a 2,000 min/month cap on private —
  relevant given the "$0, roughly monthly rebuild" constraint.
