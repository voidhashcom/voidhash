import {
  STYLE_DEFAULTS,
  type StylePropertyName,
  type StylePropertyTypes
} from '../styles';

/** Pick only the supported properties from StylePropertyTypes */
export type PickStyles<K extends StylePropertyName> = Pick<
  StylePropertyTypes,
  K
>;

/** Get defaults for a specific set of properties with optional overrides */
export function getStyleDefaults<K extends StylePropertyName>(
  properties: readonly K[],
  overrides?: Partial<StylePropertyTypes>
): PickStyles<K> {
  const result: Partial<StylePropertyTypes> = {};
  for (const prop of properties) {
    result[prop] = overrides?.[prop] ?? STYLE_DEFAULTS[prop];
  }
  return result as PickStyles<K>;
}
