#!/usr/bin/env node
/**
 * Parses Lennox's official "AIR CONDITIONER AHRI SYSTEM MATCHES" bulletin
 * (a real PDF Lennox publishes at lennox.com, not a distributor
 * compilation) into a sourcedBatchLoader-compatible YAML batch.
 *
 * Input: plain text extracted via `pdftotext -layout <pdf> <txt>` (poppler-
 * utils). Requires poppler-utils to regenerate from a fresh PDF; the text
 * dump itself is not committed (see .gitignore) since it's a derived
 * artifact, not a source we're citing directly — the PDF URL is the
 * citation.
 *
 * Design choice: this table has real structural inconsistency across
 * product eras (pre-2023 SEER vs. current SEER2 column layouts, rows with
 * missing capacity/EER2 values, wrapped lines from long model numbers).
 * Rather than build a parser that guesses through that ambiguity, this
 * script uses a strict line pattern and *skips* (with a logged reason) any
 * line it can't confidently parse. A skipped real row is an acceptable gap;
 * a wrongly-parsed row is not. Every run prints exactly how many rows were
 * kept vs. skipped and why, and that report is worth reading before
 * trusting the output, not just the row count.
 *
 * Usage:
 *   node scripts/ingest/parseLennoxAcMatches.mjs <input.txt> <output.yaml>
 */
import fs from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: parseLennoxAcMatches.mjs <input.txt> <output.yaml>");
  process.exit(1);
}

const SOURCE_URL = "https://www.lennox.com/dA/fe23ca3dac/ehb_ahri_lnx_ac_master_2501b.pdf";
const RETRIEVED_AT = "2026-08-16";

const lines = fs.readFileSync(inputPath, "utf-8").split("\n");

const records = [];
const skipReasons = {};

function skip(reason) {
  skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
}

for (const rawLine of lines) {
  const line = rawLine.replace(/\r$/, "");
  if (!line.trim()) continue;

  // Only look at lines that plausibly end in "<AHRI reference> <region>" --
  // everything else is header/footer/page furniture or a wrapped
  // continuation line we're not confident enough to stitch back together.
  const tailMatch = line.match(/^(.*\S)\s{2,}(\d{7,9})\s+([A-Za-z][A-Za-z ,]*)\s*$/);
  if (!tailMatch) {
    skip("no AHRI-reference/region tail found");
    continue;
  }
  const [, head, ahriRef, region] = tailMatch;

  // Split the head on runs of 2+ spaces to get column-ish tokens. Single
  // spaces stay inside a token (model numbers like "CK40[C,U]T-49C+TDR"
  // never contain a space; the *columns* are separated by wide gaps from
  // the PDF's fixed-width layout).
  const cols = head.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);

  // Expect: model_no, coil_or_air_handler, [furnace], refrigerant, ...numbers..., energyStar
  if (cols.length < 5) {
    skip("fewer than 5 columns after split");
    continue;
  }

  const modelNo = cols[0];
  const coilOrAirHandler = cols[1];

  // The PDF's column gaps aren't uniformly >=2 spaces for every row -- for
  // some (long outdoor model + long coil name) combinations the gap
  // collapses to a single space, and the split above leaves the coil name
  // (or a stray "+" marker) glommed onto the end of modelNo instead of
  // becoming its own column. There's no single reliable rule for where to
  // cut that string back apart (checked: the trailing token is sometimes a
  // real coil model, sometimes just "+", no consistent prefix pattern
  // covers both), so rather than guess, these rows are excluded entirely.
  if (/\s/.test(modelNo)) {
    skip("outdoor model token contains embedded whitespace (column-spacing collapse in source PDF, not safely splittable)");
    continue;
  }

  const refrigIndex = cols.findIndex((c) => /^R-\d{2,4}[A-Z]?$/.test(c));
  if (refrigIndex === -1) {
    skip("no recognizable refrigerant token (R-###[letter])");
    continue;
  }
  const refrigerant = cols[refrigIndex];

  // Only current A2L equipment is in scope for this site.
  if (refrigerant !== "R-454B") {
    skip("refrigerant is not R-454B (out of scope for this pilot)");
    continue;
  }

  // Furnace is whatever sits between coil/air-handler and refrigerant, if
  // anything -- straight-cool systems have no furnace column at all here.
  const furnaceCols = cols.slice(2, refrigIndex);
  const furnace = furnaceCols.length === 1 && furnaceCols[0] !== "- - -" ? furnaceCols[0] : undefined;
  if (furnaceCols.length > 1) {
    skip("ambiguous furnace column (more than one token between coil and refrigerant)");
    continue;
  }

  // Energy Star Yes/No should be the last column before we already split
  // off AHRI ref/region.
  const lastCol = cols[cols.length - 1];
  if (lastCol !== "Yes" && lastCol !== "No") {
    skip("last column before AHRI ref is not Yes/No (Energy Star)");
    continue;
  }
  const energyStar = lastCol === "Yes";

  // Numeric columns between refrigerant and Energy Star: mix of "- - -"
  // placeholders (legacy pre-2023 ratings, not applicable here) and real
  // numbers. Use magnitude to identify capacity (BTU, > 1000) vs.
  // SEER2/EER2 (single/double-digit decimals) rather than trusting
  // position, since position shifts row to row.
  const numericCols = cols.slice(refrigIndex + 1, cols.length - 1);
  const numbers = numericCols
    .join(" ")
    .split(/\s+/)
    .filter((t) => t !== "-" && t !== "")
    .map(Number)
    .filter((n) => !Number.isNaN(n));

  const capacityCandidates = numbers.filter((n) => n > 1000);
  const ratingCandidates = numbers.filter((n) => n > 0 && n <= 30);

  if (capacityCandidates.length > 1 || ratingCandidates.length > 2) {
    skip("more numeric candidates than expected (ambiguous capacity/SEER2/EER2)");
    continue;
  }

  const capacityBtu = capacityCandidates[0];
  // Header order is Capacity, SEER2, EER2 -- when both rating numbers are
  // present, first is SEER2, second is EER2.
  const seer2 = ratingCandidates.length >= 1 ? ratingCandidates[0] : undefined;
  const eer2 = ratingCandidates.length === 2 ? ratingCandidates[1] : undefined;

  records.push({
    brand: "Lennox",
    outdoor_model: modelNo,
    indoor_model: coilOrAirHandler,
    furnace_model: furnace,
    ahri_reference_number: ahriRef,
    seer2,
    refrigerant,
    capacity_btu: capacityBtu,
    eer2,
    energy_star: energyStar,
    region: region.trim(),
  });
}

console.log(`Parsed ${records.length} R-454B records.`);
console.log("Skipped lines by reason:");
for (const [reason, count] of Object.entries(skipReasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(6)}  ${reason}`);
}

// Sanity checks worth failing loudly on, not just logging.
const ahriRefs = records.map((r) => r.ahri_reference_number);
const duplicateRefs = ahriRefs.filter((ref, i) => ahriRefs.indexOf(ref) !== i);
if (duplicateRefs.length > 0) {
  console.warn(
    `WARNING: ${duplicateRefs.length} duplicate AHRI reference number(s) found ` +
      `(same issue class as the Goodman/Daikin pilot batch). Not blocking the ` +
      `write, but these will need notes flagging them, same as before: ` +
      `${[...new Set(duplicateRefs)].slice(0, 10).join(", ")}${duplicateRefs.length > 10 ? "…" : ""}`,
  );
}

const yamlLines = [];
yamlLines.push(
  "# Ingestion batch: Lennox \"AHRI System Matches\" bulletin (official Lennox",
  "# publication, Bulletin No. 210827, Jan 2025B), R-454B rows only.",
  "#",
  "# Generated by scripts/ingest/parseLennoxAcMatches.mjs -- do not hand-edit",
  "# this file; re-run the script against a fresh copy of the source PDF and",
  "# commit the regenerated output instead, so the script stays the source of",
  "# truth. See that script's header comment for parsing decisions.",
  "#",
  "# confidence: verified, not needs_review -- unlike the Goodman/Daikin pilot",
  "# batch, this is a manufacturer's own official published document (hosted",
  "# on lennox.com), not a third-party distributor compilation. The rows below",
  "# are the ones the parser could extract with high confidence; ambiguous",
  "# lines were skipped rather than guessed at (see the script's console",
  "# output from the run that generated this file).",
  "document:",
  `  source_url: "${SOURCE_URL}"`,
  "  source_type: manufacturer_pdf",
  `  retrieved_at: ${RETRIEVED_AT}`,
  "  brand: Lennox",
  "  confidence: verified",
  "",
  "records:",
);

for (const r of records) {
  yamlLines.push(`  - outdoor_model: ${JSON.stringify(r.outdoor_model)}`);
  yamlLines.push(`    indoor_model: ${JSON.stringify(r.indoor_model)}`);
  if (r.furnace_model) yamlLines.push(`    furnace_model: ${JSON.stringify(r.furnace_model)}`);
  yamlLines.push(`    ahri_reference_number: ${JSON.stringify(r.ahri_reference_number)}`);
  if (r.seer2 !== undefined) yamlLines.push(`    seer2: ${r.seer2}`);
  if (r.eer2 !== undefined) yamlLines.push(`    eer2: ${r.eer2}`);
  if (r.capacity_btu !== undefined) yamlLines.push(`    capacity_btu: ${r.capacity_btu}`);
  yamlLines.push(`    energy_star: ${r.energy_star}`);
  yamlLines.push(`    region: ${JSON.stringify(r.region)}`);
  yamlLines.push(`    refrigerant: ${r.refrigerant}`);
  if (duplicateRefs.includes(r.ahri_reference_number)) {
    yamlLines.push(
      `    notes: "This AHRI reference number appears more than once in the source document for different model combinations -- likely a source transcription issue, not corrected here. See DECISIONS.md."`,
    );
    yamlLines.push(`    confidence: needs_review`);
  }
  yamlLines.push("");
}

fs.writeFileSync(outputPath, yamlLines.join("\n"));
console.log(`\nWrote ${records.length} records to ${outputPath}`);
