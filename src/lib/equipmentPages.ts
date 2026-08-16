import { getCollection, type CollectionEntry } from "astro:content";
import { slugify } from "./slugify";

export interface ModelGroup {
  brand: string;
  brandSlug: string;
  outdoorModel: string;
  modelSlug: string;
  records: CollectionEntry<"equipmentMatches">[];
}

/**
 * Groups equipment-match records by (brand, outdoor_model) and assigns a
 * stable, collision-free URL slug to each group.
 *
 * Some Lennox rows have model strings that differ only in characters
 * slugify() strips (e.g. "EL22KCV-060-230A**" vs "EL22KCV-060-230A** +" --
 * two genuinely different listings in the source: one pairs a furnace, one
 * doesn't; what the trailing "+" denotes isn't stated anywhere retrievable,
 * so it's not guessed at). Rather than silently merge them onto one page or
 * let a build produce two files at the same path, collisions get a
 * deterministic "-2", "-3", ... suffix based on sorted raw-model order, so
 * both stay independently addressable and the choice is reproducible
 * across rebuilds, not dependent on collection iteration order.
 */
let cachedGroups: ModelGroup[] | null = null;

export async function getModelGroups(): Promise<ModelGroup[]> {
  if (cachedGroups) return cachedGroups;

  interface RawGroup {
    brand: string;
    outdoorModel: string;
    records: CollectionEntry<"equipmentMatches">[];
  }

  const allRecords = await getCollection("equipmentMatches");
  const byKey = new Map<string, RawGroup>();

  for (const record of allRecords) {
    const key = `${record.data.brand}::${record.data.outdoor_model}`;
    if (!byKey.has(key)) {
      byKey.set(key, { brand: record.data.brand, outdoorModel: record.data.outdoor_model, records: [] });
    }
    byKey.get(key)!.records.push(record);
  }

  // Group by (brandSlug, modelSlug) to find collisions before assigning final slugs.
  const bySlug = new Map<string, RawGroup[]>();
  for (const group of byKey.values()) {
    const slugKey = `${slugify(group.brand)}/${slugify(group.outdoorModel)}`;
    if (!bySlug.has(slugKey)) bySlug.set(slugKey, []);
    bySlug.get(slugKey)!.push(group);
  }

  const result: ModelGroup[] = [];
  for (const [slugKey, groups] of bySlug) {
    const [brandSlug, baseModelSlug] = slugKey.split("/");
    const sorted = [...groups].sort((a, b) => a.outdoorModel.localeCompare(b.outdoorModel));
    sorted.forEach((group, index) => {
      const modelSlug = index === 0 ? baseModelSlug : `${baseModelSlug}-${index + 1}`;
      result.push({
        brand: group.brand,
        brandSlug,
        outdoorModel: group.outdoorModel,
        modelSlug,
        records: group.records,
      });
    });
  }

  cachedGroups = result;
  return result;
}
