import { SCHEMA_KIND, SchemaKind } from "./constants";

export abstract class PerkDefinition {
  readonly [SCHEMA_KIND] = SchemaKind.Perk;
  slug: string;
  name: string;
  constructor(slug: string, params: { name: string }) {
    this.slug = slug;
    this.name = params.name;
  }
}

export class UnlockablePerkDefinition extends PerkDefinition {}

export const unlockablePerk = (
  slug: string,
  params: { name: string }
): UnlockablePerkDefinition => new UnlockablePerkDefinition(slug, params);
