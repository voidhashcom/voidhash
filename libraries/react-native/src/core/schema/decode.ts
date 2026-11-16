import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";

import {
  RuntimePaywallLocationDefinition,
  RuntimePerkDefinition,
  RuntimeProductDefinition,
  type RuntimeSchema,
} from "./runtime";

/** A schema entry this SDK version could not read, left out of the decoded schema. */
export interface SkippedSchemaEntry {
  readonly collection: "locations" | "perks" | "products";
  readonly slug: string;
}

const decodeLocation = Schema.decodeUnknownResult(RuntimePaywallLocationDefinition);
const decodePerk = Schema.decodeUnknownResult(RuntimePerkDefinition);
const decodeProduct = Schema.decodeUnknownResult(RuntimeProductDefinition);

const RuntimeSchemaDocument = Schema.Struct({
  locations: Schema.Record(Schema.String, Schema.Unknown),
  // The native iOS client's schema has no perks of its own; they are read from each product.
  perks: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  products: Schema.Record(Schema.String, Schema.Unknown),
  version: Schema.String,
});

/**
 * Decodes a schema entry by entry. A product, perk or location this SDK
 * version cannot read is left out and listed in `skipped`, so one entry a
 * newer server shapes differently never costs the app every other product.
 * Fails only when the document itself is not a schema.
 */
export const decodeRuntimeSchema = (input: unknown) =>
  Effect.map(Schema.decodeUnknownEffect(RuntimeSchemaDocument)(input), (document) => {
    const [locations, unreadableLocations] = R.partition(document.locations, (entry) =>
      decodeLocation(entry),
    );
    const [perks, unreadablePerks] = R.partition(document.perks ?? {}, (entry) =>
      decodePerk(entry),
    );
    const [products, unreadableProducts] = R.partition(document.products, (entry) =>
      decodeProduct(entry),
    );
    const skipped: ReadonlyArray<SkippedSchemaEntry> = [
      ...R.keys(unreadableLocations).map((slug) => ({ collection: "locations" as const, slug })),
      ...R.keys(unreadablePerks).map((slug) => ({ collection: "perks" as const, slug })),
      ...R.keys(unreadableProducts).map((slug) => ({ collection: "products" as const, slug })),
    ];
    const schema: RuntimeSchema = { locations, perks, products, version: document.version };
    return { schema, skipped };
  });
