export abstract class PerkDefinition {
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
): UnlockablePerkDefinition => {
  return new UnlockablePerkDefinition(slug, params);
};
