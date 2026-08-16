import type { Loader } from "astro/loaders";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYAML } from "yaml";

/**
 * Loads content-collection entries from hand/script-authored YAML "ingestion
 * batch" files. Each file represents one source document that was actually
 * retrieved (a manufacturer PDF, an EPA rule, a distributor chart, etc.) and
 * contains:
 *
 *   document:  # defaults applied to every record below, unless overridden
 *     source_url: "https://..."
 *     source_type: manufacturer_pdf
 *     retrieved_at: 2026-08-16
 *   records:
 *     - { ...fields specific to this collection... }
 *
 * This is the "never guess a spec value" rule enforced structurally: a batch
 * with no source_url fails the build immediately, before Zod even gets a
 * chance to validate individual records. See DECISIONS.md.
 */
export function sourcedBatchLoader(sourceDir: string): Loader {
  return {
    name: "sourced-batch-loader",
    load: async ({ store, logger, parseData }) => {
      store.clear();
      const absDir = path.resolve(sourceDir);

      if (!fs.existsSync(absDir)) {
        logger.warn(
          `No source directory at ${sourceDir} — collection will be empty. ` +
            `This is expected for content areas that haven't been ingested yet; ` +
            `it must never be filled with invented placeholder rows.`,
        );
        return;
      }

      const files = fs
        .readdirSync(absDir)
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

      for (const filename of files) {
        const fullPath = path.join(absDir, filename);
        const raw = fs.readFileSync(fullPath, "utf-8");
        const batch = parseYAML(raw) as {
          document?: Record<string, unknown>;
          records?: Record<string, unknown>[];
        };

        const doc = batch.document;
        if (!doc || typeof doc.source_url !== "string" || doc.source_url.trim() === "") {
          throw new Error(
            `[sourced-batch-loader] ${filename}: batch is missing a required ` +
              `document.source_url. Every ingestion batch must cite exactly where ` +
              `its data came from — refusing to load this file.`,
          );
        }
        if (!Array.isArray(batch.records) || batch.records.length === 0) {
          throw new Error(
            `[sourced-batch-loader] ${filename}: batch has no records array (or it's empty).`,
          );
        }

        const baseId = path.basename(filename, path.extname(filename));

        for (const [index, record] of batch.records.entries()) {
          const id = `${baseId}--${index}`;
          const merged = {
            ...doc,
            ...record,
            // Row-level values win when present; otherwise fall back to the
            // batch's document-level provenance so we don't repeat the same
            // source_url/source_type/retrieved_at on every single row.
            source_url: record.source_url ?? doc.source_url,
            source_type: record.source_type ?? doc.source_type,
            retrieved_at: record.retrieved_at ?? doc.retrieved_at,
          };
          const data = await parseData({ id, data: merged });
          store.set({ id, data });
        }

        logger.info(`Loaded ${batch.records.length} record(s) from ${filename}`);
      }
    },
  };
}
