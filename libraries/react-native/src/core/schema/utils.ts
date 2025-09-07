import { ProductDefinition } from './products/base';
import type { ExtractSchemaProductDefinitions, VoidhashSchema } from './types';

export function extractProductDefinitions<TSchema extends VoidhashSchema>(
  schema: TSchema
): ExtractSchemaProductDefinitions<TSchema> {
  const productDefinitions = {} as ExtractSchemaProductDefinitions<TSchema>;

  for (const [key, value] of Object.entries(schema)) {
    if (value instanceof ProductDefinition) {
      // @ts-expect-error - TypeScript can't infer that key is a valid product key, but we know it is
      productDefinitions[key] = value;
    }
  }

  return productDefinitions;
}
