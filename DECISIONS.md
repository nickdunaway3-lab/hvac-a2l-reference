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

## First real usability pass (2026-08-16)

User feedback after the site was live and functional: "not user friendly, I
don't know how to use it." Confirmed four specific gaps, not a vague
complaint:

- Homepage was a title and one paragraph — no orientation for either
  audience (homeowner vs. technician), no clear next step.
- Equipment-matching table was raw model numbers and AHRI reference numbers
  with zero explanation of what an "AHRI match" is or why it matters to
  someone comparing a quote.
- Every pilot row shows "Unconfirmed" (correctly, per the provenance
  design), but with no framing that reads as "this site is broken," not "the
  site is being honest about what it hasn't verified yet."
- The lead-capture CTA only existed as a small nav link — nothing on the
  data page itself pointed there, even though "found your equipment, still
  confused about the quote" is exactly the moment that page should hand off.

Fixes: homepage now splits into two explicit path cards (homeowner /
technician) instead of one generic paragraph; added `<ConfidenceExplainer>`
(reusable — will get dropped onto every future data page, not just this
one) explaining the verified/needs_review system *before* a visitor hits a
wall of badges; added a CTA box at the bottom of the equipment table
pointing to the quote-review page; added client-side search/filter on the
equipment table (plain JS, no dependency — matters more as the dataset
grows past one pilot batch). Verified all of this landed in the actual
built HTML, not just written and assumed.

This is a good example of why "prove the pipeline first, polish later" was
the right sequencing: the underlying data/schema work didn't need to change
at all for this pass — only presentation did.

## Lead capture (2026-08-16)

- Built as designed earlier: Cloudflare Turnstile (client) → Google Apps
  Script Web App (server-side Turnstile verification + Sheet write) → Google
  Sheet. Source for the Apps Script side lives in
  `scripts/apps-script/leadCapture.gs`, with setup steps in that folder's
  README, because Apps Script deployment requires a Google OAuth
  click-through that can't be scripted from outside a browser — this is a
  one-time manual step, not a gap in automation.
- The Turnstile *secret* key is never committed — it's stored in the Apps
  Script project's Script Properties, set once through the Apps Script UI.
  Only the *site* key (meant to be public) goes in the site's own env vars.
- Client posts with `Content-Type: text/plain`, not `application/json`,
  deliberately — keeps the request a CORS "simple request" so the browser
  skips a preflight OPTIONS call, which Apps Script Web Apps have no way to
  answer. The body is still parsed as JSON on the Apps Script side.
- A honeypot field (`website`) is accepted silently rather than rejected, so
  bots submitting it don't learn to adapt.
- `<LeadCaptureForm>` renders a plain "not open yet" message instead of a
  form when `PUBLIC_TURNSTILE_SITE_KEY` / `PUBLIC_LEAD_CAPTURE_ENDPOINT`
  aren't set — verified this actually happens (checked the built HTML output
  directly) rather than assuming the conditional works. Same rule as
  `AffiliateLink`: never ship something that looks live but isn't.
- First real page using it: `/get-your-quote-reviewed/`. Turnstile widget
  and Apps Script Web App are both live as of 2026-08-16 — confirmed by
  checking the deployed HTML directly (real `data-sitekey` and
  `data-endpoint` present, fallback message gone), not just "should work."
  Not yet end-to-end tested with an actual form submission (Turnstile
  requires a real browser challenge, which can't be scripted) — next time
  the site is open, submit the form once and confirm a row lands in the
  "Leads" sheet.

## Expanding coverage + fixing "it's all just sourcing, no content" (2026-08-16)

Feedback after the usability pass: the equipment-matching page felt thin —
lots of provenance chrome (badges, source links, retrieval dates), not much
actual answer. Root cause was real, not just presentation: the only data on
the site was 27 hand-transcribed rows from one third-party distributor
chart, so *nothing* could honestly be marked `verified` and every row was
"Unconfirmed." That's a content-coverage problem as much as a design one.

- Found that Lennox publishes its own official AHRI match bulletin directly
  on lennox.com (Bulletin No. 210827, "Supersedes All Previous Versions") —
  a primary manufacturer source, not a distributor's compilation. Data from
  it can honestly carry `confidence: verified`.
- The document is huge (~148k lines of extracted text, spanning both
  current R-454B and legacy R-410A listings back to 2017-era ratings) and
  has real structural inconsistency across product eras — different column
  layouts depending on refrigerant/vintage, rows with missing capacity/EER2,
  and line-wrap artifacts from `pdftotext`. Hand-transcribing this the way
  the Goodman/Daikin pilot was done wasn't viable at this scale, and a naive
  bulk parser risked silently mis-extracting values across that
  inconsistency — which would be worse than the thin-content problem it was
  meant to fix.
- Wrote `scripts/ingest/parseLennoxAcMatches.mjs`: a strict parser that only
  accepts lines matching a clean, validated pattern (recognizable
  refrigerant token, unambiguous furnace column, exactly the expected count
  of numeric fields) and *skips* — with a logged, categorized reason —
  anything ambiguous rather than guessing through it. Filtered to R-454B
  only (current A2L equipment is what this site is about; the legacy R-410A
  rows in the same document are out of scope for now, not deleted from the
  source, just not ingested).
- Result: 8,656 of ~10,341 R-454B candidate rows parsed cleanly (the rest
  skipped for a specific, logged reason — mostly ambiguous numeric-column
  counts). Verified correctness by cross-referencing multiple extracted
  records (start, middle, and end of the output) directly against the raw
  source lines by hand — exact match on every field, including a row where
  the source had no capacity/SEER2/EER2 data at all and the parser correctly
  left those fields unset rather than inventing zeros.
- One real anomaly found during verification: AHRI reference number
  215582988 appears twice in the source — once as a complete row, once as
  an orphaned fragment (just a stray number and "Yes All", almost certainly
  a `pdftotext` line-wrap artifact from the PDF's layout). The parser
  correctly discarded the fragment (too few columns to parse confidently)
  and kept only the complete row. This is the same discipline as the
  Goodman/Daikin batch's duplicate-AHRI-number handling: the script's
  duplicate check still runs and would flag+downgrade to `needs_review` if
  a duplicate *did* make it through, in case a future document has a case
  where both halves parse cleanly.
- Known limitation, stated plainly: this parser is conservative by design,
  which means it undercounts the true table (some legitimate rows are
  almost certainly lost to line-wrap fragmentation this approach can't
  reassemble). That's the correct tradeoff for this site — an undercount is
  an honest gap; a silently wrong row is not.
- Schema gained three fields this batch's source data supports and that are
  genuinely useful, not just "more data for its own sake": `eer2`,
  `capacity_btu`, `energy_star`, and `region`. `region` matters specifically
  — DOE regional efficiency standards restrict some systems to certain parts
  of the country, so a region-restricted system on a quote outside its
  region is a real, checkable red flag for the homeowner audience.
- **Page architecture had to change along with the data volume.** Going
  from 27 to 8,683 records meant the existing "render every row into the
  page's HTML, filter with a small JS loop" approach would have produced a
  multi-megabyte page — the opposite of fixing "not user friendly."
  Replaced it with a static JSON endpoint
  (`src/pages/data/equipment-matches.json.ts`, pre-rendered at build time,
  no server involved) fetched client-side only once a visitor actually
  searches (3-character minimum before anything renders, results capped at
  200 with a "refine your search" message beyond that). Verified the fix
  actually worked: the equipment-matching page itself is ~9KB regardless of
  dataset size; the 3.9MB JSON only loads on interaction, not on page load.
- `scripts/ingest/parseLennoxAcMatches.mjs` is the source of truth for this
  batch, not the committed YAML — re-run it against a freshly fetched copy
  of the PDF (via `pdftotext -layout`) to pick up Lennox's updates. Requires
  poppler-utils (`pdftotext`) on whatever machine/CI runs it — noted here so
  the scheduled GitHub Action remembers to install it.

## Deployment (2026-08-16)

- Cloudflare's dashboard nav has been reorganized (Pages is being folded into
  Workers) and the old "Workers & Pages → Connect to Git" click-path no
  longer matches what's on screen. Rather than chase a moving UI, deployed
  via a scoped API token (Account → Cloudflare Pages → Edit only) and the
  `wrangler` CLI instead — stable regardless of dashboard changes, and it's
  the same tool the scheduled rebuild Action will use later, so this isn't a
  throwaway path.
- Live at **https://hvac-a2l-reference.pages.dev**. Verified content, not
  just a 200: fetched the deployed equipment-matching page and confirmed all
  27 pilot records rendered (7 Goodman + 7 Daikin outdoor models, exact row
  count match) with every row correctly showing the `needs_review` /
  "Unconfirmed" badge state.
- `wrangler` added as a devDependency (needed locally and in CI; not needed
  in the deployed output itself).
- Not yet wired to auto-deploy on push — that lands with the scheduled
  GitHub Action (re-ingest + rebuild + `wrangler pages deploy`), using the
  same API token stored as a GitHub Actions secret, not committed anywhere.

## Tooling

- Node.js LTS and GitHub CLI were not present on this machine; installed via
  `winget` (both free, standard, uninstallable dev tools).
- Astro, minimal template, TypeScript strict, static output. Telemetry
  disabled.
- GitHub repo created **public** specifically because GitHub Actions minutes
  are free/unmetered on public repos, vs. a 2,000 min/month cap on private —
  relevant given the "$0, roughly monthly rebuild" constraint.
