import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

/**
 * Pre-rendered static JSON of every equipment-matching record, fetched
 * client-side by the equipment-matching page's search UI. Once the dataset
 * grew from 27 records (the Goodman/Daikin pilot) to ~8,700 (adding
 * Lennox's full R-454B catalog), rendering every row into the page's HTML
 * at build time stopped being reasonable — this keeps the page itself
 * light and defers the data to an async fetch, still 100% static output,
 * no server involved.
 */
export const GET: APIRoute = async () => {
  const matches = await getCollection("equipmentMatches");
  const payload = matches.map((m) => ({
    brand: m.data.brand,
    outdoor_model: m.data.outdoor_model,
    indoor_model: m.data.indoor_model,
    coil_orientation: m.data.coil_orientation ?? null,
    furnace_model: m.data.furnace_model ?? null,
    ahri_reference_number: m.data.ahri_reference_number,
    seer2: m.data.seer2 ?? null,
    seer: m.data.seer ?? null,
    eer2: m.data.eer2 ?? null,
    capacity_btu: m.data.capacity_btu ?? null,
    energy_star: m.data.energy_star ?? null,
    region: m.data.region ?? null,
    refrigerant: m.data.refrigerant ?? null,
    confidence: m.data.confidence,
    source_url: m.data.source_url,
    retrieved_at: m.data.retrieved_at.toISOString(),
    notes: m.data.notes ?? null,
  }));

  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
};
