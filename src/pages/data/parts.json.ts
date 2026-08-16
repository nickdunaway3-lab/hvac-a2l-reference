import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

/** Pre-rendered static JSON of every parts record, same pattern as
 * equipment-matches.json.ts and for the same reason -- fetched client-side
 * on demand rather than baked into every page. */
export const GET: APIRoute = async () => {
  const parts = await getCollection("parts");
  const payload = parts.map((p) => ({
    brand: p.data.brand,
    outdoor_model: p.data.outdoor_model,
    part_number: p.data.part_number,
    description: p.data.description,
    category: p.data.category ?? null,
    confidence: p.data.confidence,
    source_url: p.data.source_url,
    retrieved_at: p.data.retrieved_at.toISOString(),
    notes: p.data.notes ?? null,
  }));

  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
};
