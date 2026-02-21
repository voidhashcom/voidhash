import { SCHEMA_KIND, SchemaKind } from "./constants";

export interface PaywallLocationDefinitionProperties {
  description?: string;
  name: string;
}

export class PaywallLocationDefinition<TSlug extends string = string> {
  readonly [SCHEMA_KIND] = SchemaKind.PaywallLocation;
  slug: TSlug;
  name: string;
  description: string | null;

  constructor(slug: TSlug, params: PaywallLocationDefinitionProperties) {
    this.slug = slug;
    this.name = params.name;
    this.description = params.description ?? null;
  }
}
