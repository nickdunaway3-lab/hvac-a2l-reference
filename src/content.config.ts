import { defineCollection, z } from "astro:content";
import { sourcedBatchLoader } from "./lib/sourcedBatchLoader";

/**
 * Every fact on this site must carry these four fields. This is the whole
 * moat: nothing renders as settled fact unless it's traceable to a source we
 * actually retrieved. See DECISIONS.md and the brief's "single most
 * important rule."
 */
const provenanceFields = {
  source_url: z.string().url(),
  source_type: z.enum([
    "manufacturer_pdf",
    "manufacturer_web",
    "distributor_compiled_reference",
    "ahri_certificate_lookup",
    "epa_rule",
    "federal_register",
    "state_code_agency",
    "icc_adoption_chart",
    "other_primary",
  ]),
  retrieved_at: z.coerce.date(),
  confidence: z.enum(["verified", "needs_review"]),
  // Free-text: why needs_review, a flagged discrepancy in the source, or any
  // other context a page template should be able to surface.
  notes: z.string().optional(),
};

// --- Content area 1: equipment matching -----------------------------------
const equipmentMatches = defineCollection({
  loader: sourcedBatchLoader("src/data/sources/equipment-matches"),
  schema: z.object({
    brand: z.string(),
    outdoor_model: z.string(),
    indoor_model: z.string(),
    coil_orientation: z.enum(["upflow", "horizontal", "air_handler", "unspecified"]).optional(),
    furnace_model: z.string().optional(),
    ahri_reference_number: z.string(),
    seer2: z.number().optional(),
    seer: z.number().optional(),
    eer2: z.number().optional(),
    capacity_btu: z.number().optional(),
    energy_star: z.boolean().optional(),
    // DOE regional efficiency standards split the US into regions (North /
    // Southeast / Southwest / "All"). A system rated for one region only is
    // a real installation-legality question, not a nice-to-have.
    region: z.string().optional(),
    // Only ever set this when a source explicitly states it — never inferred
    // from "this brand generally uses X." Most ingested rows will leave it
    // unset until a spec sheet confirms it per model.
    refrigerant: z.enum(["R-410A", "R-454B", "R-32"]).optional(),
    ...provenanceFields,
  }),
});

// --- Replacement parts (per outdoor unit model) -----------------------------
// Deliberately NOT "most commonly fails" claims -- there's no sourceable
// failure-rate data. These are official OEM part numbers from manufacturer
// parts manuals, the same evidentiary bar as everything else on the site.
const parts = defineCollection({
  loader: sourcedBatchLoader("src/data/sources/parts"),
  schema: z.object({
    brand: z.string(),
    outdoor_model: z.string(),
    part_number: z.string(),
    description: z.string(),
    // Keyword-derived UI grouping label, not a manufacturer-stated fact --
    // see the ingestion script that generates it.
    category: z.string().optional(),
    ...provenanceFields,
  }),
});

// --- Content area 2: line set reuse ----------------------------------------
const lineSetReuse = defineCollection({
  loader: sourcedBatchLoader("src/data/sources/line-set-reuse"),
  schema: z.object({
    brand: z.string(),
    applies_to: z.string(), // e.g. "R-454B split systems, GSXC7 series"
    max_line_set_age_years: z.number().optional(),
    flush_required: z.boolean(),
    oil_type: z.string().optional(),
    requirement_text: z.string(),
    ...provenanceFields,
  }),
});

// --- Content area 3: leak detection requirements ---------------------------
const leakDetection = defineCollection({
  loader: sourcedBatchLoader("src/data/sources/leak-detection"),
  schema: z.object({
    brand: z.string(),
    model_or_series: z.string(),
    charge_threshold_lb: z.number().optional(),
    requirement_text: z.string(),
    ...provenanceFields,
  }),
});

// --- Content area 4: state/local code adoption -----------------------------
// Deliberately edition + source link only. No computed "is A2L allowed here"
// field — that's an inference this site refuses to make. See DECISIONS.md.
const stateCodeAdoption = defineCollection({
  loader: sourcedBatchLoader("src/data/sources/state-code-adoption"),
  schema: z.object({
    state: z.string(),
    code_type: z.enum(["IMC", "IRC", "IFC", "IECC", "UMC", "other"]),
    edition_adopted: z.string(), // e.g. "2021 IMC"
    adopted_effective_date: z.coerce.date().optional(),
    ...provenanceFields,
  }),
});

// --- Content area 5: R-410A / A2L service availability facts ---------------
const refrigerantAvailability = defineCollection({
  loader: sourcedBatchLoader("src/data/sources/refrigerant-availability"),
  schema: z.object({
    topic: z.string(),
    statement: z.string(),
    effective_date: z.coerce.date().optional(),
    ...provenanceFields,
  }),
});

export const collections = {
  equipmentMatches,
  parts,
  lineSetReuse,
  leakDetection,
  stateCodeAdoption,
  refrigerantAvailability,
};
