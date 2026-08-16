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

## Parts feature: corrected scope, real pilot, affiliate-ready (2026-08-16)

Requested as "most common repair parts" per model with purchase links. The
"most common" framing had to be pushed back on before building anything:
there's no sourceable failure-rate data for HVAC parts by model — that
number doesn't exist publicly, so providing it would mean either scraping
someone's unverified opinion or generating a plausible-sounding list from
general HVAC knowledge and attaching it to specific model numbers. That's
exactly the fabrication the site's core rule exists to prevent, and doing
it quietly would have undermined every "verified" badge already on the
site. Proposed the sourceable version instead — official OEM part numbers
per model — and confirmed it before building.

- **Also checked and rejected**: scraping RepairClinic's own model→parts
  lookup tool to build the dataset, even though they have a real affiliate
  program (6% commission, 7-day cookie, confirmed in Phase 1-style
  research). Their `robots.txt` explicitly disallows exactly that feature
  (`Disallow: /Shop-For-Parts/*/*?model=*`, `/*?symptoms=odel`, `/*/data`,
  `/*/params`). Same category of problem as the AHRI Directory: an
  affiliate program grants permission to link *to* a site for a purchase,
  not to scrape its own database. The two are easy to conflate and worth
  keeping distinct going forward for any future retailer partner.
- **Real primary source found and used instead**: Goodman's own official
  GSXN4 repair parts manual (RP-G4328, © Goodman Manufacturing Company,
  L.P., September 2022) — a real manufacturer document (copyright notice
  in the document itself) that happens to cover exactly the 7 outdoor
  models already in the GSXN4 equipment-match batch. Confirmed the
  document's own "Expanded Model Nomenclature" section explicitly maps its
  internal M1–M7 codes to those 7 model numbers (our data omits the
  manual's trailing "AA" suffix — handled explicitly in the parser, not
  assumed).
- `scripts/ingest/parseGoodmanGsxn4Parts.mjs`: parses the manual's
  "Functional Parts List" section (skipped the illustration/diagram
  sections in this pass — more complex format, lower priority). Handles
  line-wrapped model-code parentheticals. 68 (model, part) pairs from 29
  distinct parts, each exploded into one row per model it applies to.
  Verified by hand against the raw source text for one full model
  (GSXN401810 / "M1") before trusting it — all 10 parts matched exactly.
  Confidence: `verified` (manufacturer's own document, not a distributor
  compilation, unlike the equipment-matching pilot batch).
- New `parts` content collection: `brand`, `outdoor_model`, `part_number`,
  `description`, optional `category` (a keyword-derived UI grouping label
  for filtering — explicitly documented as *not* a manufacturer-stated
  fact, to keep that distinction honest), plus the standard provenance
  fields.
- UI: parts render under a selected model in the Browse tab (not per
  search result row — the same outdoor model can appear in many rows via
  different indoor/furnace pairings, so tying parts to search results
  would have repeated the same list redundantly; Browse's one-model-at-a-
  time flow was already the right shape for this).
- Affiliate link for parts: added a `repairclinic` network to
  `affiliateLinks.ts` alongside `amazon`, same "return null / render plain
  instead of fake" discipline. No program joined yet, so "Find this part"
  currently links to RepairClinic's public search (plain, no `rel=sponsored`,
  not yet monetized) — swaps automatically to a tracked affiliate link the
  moment `PUBLIC_REPAIRCLINIC_AFFILIATE_URL_TEMPLATE` is set, no code
  change needed.
- Images for parts: same sourcing question as the brand logos, not
  resolved yet — real product photos need a legitimate source (distributor
  catalog, not scraped search results), left out of this pass and flagged
  to the user rather than built without asking.
- Verified via screenshot before shipping: selected Goodman → GSXN401810 in
  Browse, confirmed all 10 real parts render with correct part numbers/
  descriptions matching the source manual, "Find this part" links present,
  explanatory copy uses the corrected framing (not "commonly fails").
- **Scope note, stated plainly**: this covers exactly one model family
  (GSXN4, 7 units) out of 8,683 equipment records. Scaling parts coverage
  means finding and parsing a parts manual per model family — the same
  incremental, source-by-source work as equipment matching itself, not a
  one-time addition.

## SEO audit and Phase A fixes (2026-08-16)

User audit of the live site, six findings, all verified against the actual
codebase before any code changed (not taken at face value, not dismissed
either):

1. **No indexable pages — confirmed, worse than described.** 3 static
   pages total; the equipment-matching page's results only populate after
   a debounced `input` event following 3+ typed characters, so even a
   JS-executing crawler sees a permanently empty page (Googlebot doesn't
   simulate typing). Also found and fixed in the same pass, not in the
   original six: no `robots.txt`, no sitemap, no canonical tags anywhere.
2. **Four of five content areas missing — confirmed exactly.** Zero batch
   files in `line-set-reuse/`, `leak-detection/`, `state-code-adoption/`,
   `refrigerant-availability/`.
3. **No geographic dimension — confirmed exactly.** Zero state/city pages
   anywhere in `src/pages`.
4. **Methodology explanation crowding out content — confirmed.** Four
   distinct blocks (homepage callout, equipment-matching callout,
   `ConfidenceExplainer`, footer) repeating the same sourcing/confidence
   explanation across the site.
5. **Confidence ratio — corrected in the good direction.** Computed
   directly from source YAML: 99.7% verified (8,596/8,623 after the Lennox
   fix below), not inverted. The only `needs_review` content is the
   original 27-record Goodman/Daikin pilot batch.
6. **Lead capture — confirmed wired, honestly incomplete beyond that.**
   Static inspection confirms correct `data-sitekey`/`data-endpoint` on the
   live page. Cannot confirm an actual submission has reached the Sheet —
   Turnstile requires a real browser solving a real challenge, not
   something that can be scripted or asserted without a human doing it.

Full findings and the proposed phased execution order were reported and
approved before any code changed, per the user's explicit request not to
touch anything until the audit was confirmed.

### A real bug found while building the fix for Finding 1

Generating one static page per outdoor-unit model required grouping
equipment-match records by `(brand, outdoor_model)` for the first time —
nothing before this had needed that grouping to be exactly right. Doing so
surfaced a real, previously-shipped data quality bug: **~128 Lennox rows
(1.5% of that batch) had the indoor coil model glommed onto the end of the
outdoor model string** (e.g. `"ML14KC1-048-230A** CK40HT-42B+TDR"` as a
single `outdoor_model` value), because `parseLennoxAcMatches.mjs`'s
2+-space column split assumed a gap that collapses to a single space in
the source PDF's layout for some long name combinations.

This had been live and undetected since the Lennox batch shipped — the
interactive search/browse tool just showed a slightly odd string in one
column, not an obvious structural failure, so nothing surfaced it. Building
one page per distinct model did, immediately, because each contaminated
row produced its own fake "unique" outdoor model.

**This means the "144 distinct models" figure reported in the SEO audit
was wrong** — inflated by exactly this bug, since every contaminated row
counted as its own model. The corrected, verified figure is **63** (Lennox
49, not 130; Goodman 7; Daikin 7). Flagged to the user directly rather than
left as a quiet correction, since it changes both a number they were given
and the urgency of brand-expansion work.

Fix, same discipline as every other ambiguous-data case on this site:
checked whether the contaminated suffix could be reliably split back into
a real outdoor model + coil model (some suffixes matched known coil-name
prefixes, but not all — some were just a stray `"+"` marker with no
recoverable meaning). No single rule covered both cases without guessing,
so rather than half-fix it, `parseLennoxAcMatches.mjs` now rejects any row
where the outdoor-model token contains whitespace, logs it as its own skip
category, and excludes it. Re-fetched the source PDF fresh, re-ran the
corrected parser, replaced the committed batch (8,656 → 8,528 records),
verified zero remaining contamination and zero URL-slug collisions before
building on top of it.

### Phase A build

- **Static per-model pages**: `/equipment/{brand}/{model}/` (63 pages),
  plus `/equipment/{brand}/` brand indexes (3) and `/equipment/` (1) — 67
  new fully-static, crawlable pages. Full match table, refrigerant, parts
  (where sourced), provenance disclosures, and neighboring-model links all
  render server-side with zero JavaScript required to see the content.
  Verified via screenshot, not assumed: fetched the built HTML directly and
  confirmed real AHRI numbers present (the exact check that proved
  Finding 1's problem in the first place).
- URL slugs strip characters like `**` (e.g. `ML13KC1-060-230A**` →
  `ml13kc1-060-230a`) for readability. Checked for slug collisions before
  building on top of the scheme — found 4 (a different, legitimate "+"
  suffix case in two Lennox rows with genuinely different data, not the
  contamination bug above) and built deterministic disambiguation
  (`-2`, `-3`, ...) into `src/lib/equipmentPages.ts` rather than silently
  merging or crashing. Turned out unnecessary after the contamination fix
  (those specific rows were part of what got excluded), but the safety net
  stays in for future data.
- The interactive search/browse tool (`/equipment-matching/`) stays — it's
  still useful, and the brief said search should be "a convenience layer,"
  not removed. It's now secondary: nav and homepage point to `/equipment/`
  first, with a cross-link into the interactive tool for people who already
  know their model number.
- `@astrojs/sitemap` added (official integration, not hand-rolled),
  `site` set in `astro.config.mjs`, `robots.txt` added pointing to it.
  Verified 71 URLs in the generated sitemap match the actual page count.
- **Methodology consolidated** to `/methodology/`: the full explanation of
  the four-field provenance model, the "never guess" rule with concrete
  examples (not just the abstract claim), what an AHRI match means, and why
  the AHRI Directory itself isn't scraped. Every other page trimmed to a
  one-line link. The glossary (`EquipmentGlossary`) was explicitly left
  alone — the user called it out as working, and it's terminology
  (SEER2, EER2, Region...), not sourcing methodology, so it wasn't in scope
  for this consolidation.
- **Lead form**: ZIP code (now required, was optional "ZIP or state"),
  equipment model, and quoted price added, per the explicit ask that a
  lead's value depends on this. Apps Script header row and append logic
  updated to match — noted in the setup README that an already-started
  Sheet needs clearing first, since the header only gets (re)written when
  the sheet is empty.
- Found and fixed three instances of the same whitespace bug while
  screenshotting the new pages: text ending right before an inline `<a>`
  or `<strong>` tag on the next source line lost its space in Astro's
  render output. Swept the rest of `src/pages` and `src/components` for
  the same pattern afterward instead of fixing them one at a time as
  found.

## Third usability pass: glossary, refrigerant column, brand badges (2026-08-16)

Follow-up requests: brand pictures/logos, plain-English explanations for
every term on the page, and — separately caught during this pass — the
refrigerant type wasn't displayed anywhere despite being the entire point
of the site.

- **Logos**: flagged before building anything. Using manufacturers' real
  trademarked logos is generally fine under nominative fair use (common
  practice on comparison sites), but it requires sourcing legitimate image
  files (ideally each manufacturer's press/media kit), not scraping
  whatever image search turns up, and this is a commercial (affiliate +
  lead-gen) site so it's worth the user knowing before it happens. Built
  colored initial badges instead for now (zero licensing question, own
  CSS) — real logos remain an option if the user wants to source them.
- **Glossary**: `EquipmentGlossary.astro`, visible by default (not a
  collapsed toggle), defining every column in plain language — Outdoor
  unit, Indoor coil (+ upflow/horizontal), Furnace, Refrigerant, SEER/SEER2,
  EER2, Region, AHRI #, Capacity, Energy Star. Placed after the
  search/browse controls (keeping search first, per the prior request) and
  before the results.
- **Refrigerant column was missing entirely** — the data was extracted and
  stored (Lennox rows: R-454B; Goodman/Daikin rows: deliberately unset,
  since that source document never stated it) but never rendered anywhere
  on the page. Added as its own column with a colored badge; rows with no
  sourced value show "not stated in source," not a blank cell and not an
  inferred guess.
- Made the per-row disclosure affordance self-explanatory: it used to be
  just a bare AHRI number as the click target, which isn't obviously
  interactive. Now reads "208786152 — source & confidence ▾".
- Playwright is being kept as a standing devDependency now rather than
  installed/removed each time — this is the third round of "screenshot
  before shipping" in one session, and it's already caught one real bug
  (the `is:global` issue) that source review alone missed.
- Verified via screenshot again before deploying, not assumed: refrigerant
  badges render correctly per brand (R-454B for Lennox, "not stated in
  source" for Goodman), glossary renders in full, expanded row-details show
  the complete verified state.

## Second usability pass: search-first, browse tab, real visual design (2026-08-16)

Follow-up request: remove the "Unconfirmed" wording from default view, put
search at the top of the page instead of after paragraphs of explanation,
add a way to browse without knowing a model number, and make it look
genuinely good, not just functional.

One request needed pushback before building: removing "Unconfirmed"
entirely would mean presenting unverified data the same as verified data —
the literal opposite of the brief's core rule. Proposed a real fix instead
and confirmed it before building: keep the distinction, but move it out of
the default row view into a per-row `<details>` disclosure (the AHRI number
itself becomes the toggle) — not hidden, just not shouting. Chosen over two
other options (hide badges only on verified rows; restyle both smaller).

- Equipment-matching page rebuilt: tabs ("Search by model" / "Browse by
  brand") immediately below the H1, search box first thing in the Search
  tab. Browse tab: brand chips (with counts) → clicking one lists its
  distinct outdoor models (130 for Lennox, 7 each for Goodman/Daikin — small
  enough for a flat chip list, checked before building it that way) →
  clicking a model shows its matches, reusing the same row renderer as
  search. Confidence/source/notes moved into a `<details>` per row, closed
  by default.
- Real visual pass on `Base.astro`'s shared styles: pill-style tabs, chip
  buttons, card-based path grid, sticky/blurred header, a proper focus ring
  on the search input, consistent border-radius and shadow tokens instead
  of ad hoc values.

**Caught a real bug by actually looking, not by assuming the CSS worked:**
screenshotted the page (Playwright + a throwaway `scripts/screenshot.mjs`,
removed after use) before shipping and found every custom style silently
not applying — plain buttons, default underlined blue links, no cards, no
tabs styling. Cause: Astro scopes `<style>` blocks to the file they're
written in; `Base.astro`'s styles were never reaching content rendered
through `<slot />` from page files, because slotted content doesn't inherit
the parent layout's scope attribute. One-line fix: `<style is:global>` on
`Base.astro`'s style block. Re-screenshotted after the fix and confirmed
the actual rendered design — cards, working tabs, chip lists, no console
errors — before deploying. This is exactly the kind of thing that looks
fine in the source and is completely broken on screen; worth remembering
for any future layout work in this codebase.
- Verified in the dev screenshots, not just asserted: homepage path cards,
  equipment-matching search results (Search tab, "GSXN401810" query, 2
  correct results), Browse tab with Lennox selected showing its 130-model
  chip list, and the quote-review form's layout (Turnstile itself showed a
  "can't connect" state in the screenshot tool's headless/localhost
  environment — a known dev-only quirk, not evidence of a production
  problem, since the live site had already been confirmed rendering the
  widget correctly with real values in an earlier check).

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
