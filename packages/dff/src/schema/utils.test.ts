import { describe, expect, it } from 'vitest';
import { s } from './index';
import { getDefaults, hasDefault, isOptional, validate } from './utils';

describe('getDefaults', () => {
  it('should return defaults for primitive schemas', () => {
    const stringSchema = s.string().default('test');
    expect(getDefaults(stringSchema)).toBe('test');

    const numberSchema = s.number().default(42);
    expect(getDefaults(numberSchema)).toBe(42);

    const booleanSchema = s.boolean().default(true);
    expect(getDefaults(booleanSchema)).toBe(true);
  });

  it('should recursively resolve object defaults', () => {
    const schema = s.object({
      name: s.string().default('Unknown'),
      age: s.number().default(0),
      active: s.boolean().default(true)
    });

    const defaults = getDefaults(schema);
    expect(defaults).toEqual({
      name: 'Unknown',
      age: 0,
      active: true
    });
  });

  it('should handle nested objects', () => {
    const schema = s.object({
      user: s.object({
        name: s.string().default('Unknown'),
        age: s.number().default(0)
      })
    });

    const defaults = getDefaults(schema);
    expect(defaults).toEqual({
      user: {
        name: 'Unknown',
        age: 0
      }
    });
  });

  it('should handle optional schemas (returns undefined)', () => {
    const schema = s.string().optional();
    expect(getDefaults(schema)).toBeUndefined();
  });

  it('should handle nested optional fields', () => {
    const schema = s.object({
      name: s.string().default('Unknown'),
      age: s.number().optional()
    });

    const defaults = getDefaults(schema);
    expect(defaults.name).toBe('Unknown');
    // Optional fields without defaults should not be included
    expect('age' in defaults).toBe(false);
  });

  it('should skip required fields without defaults', () => {
    const schema = s.object({
      name: s.string(),
      age: s.number().default(0)
    });

    const defaults = getDefaults(schema);
    // Required fields without defaults are skipped
    expect('name' in defaults).toBe(false);
    // Fields with defaults are included
    expect(defaults.age).toBe(0);
  });

  it('should handle arrays with item defaults', () => {
    const schema = s.array(s.string().default('default'));
    const defaults = getDefaults(schema);
    expect(defaults).toEqual([]);
  });

  it('should handle optional object schemas', () => {
    const schema = s.object({ name: s.string() }).optional();
    expect(getDefaults(schema)).toBeUndefined();
  });

  it('should handle complex nested structures', () => {
    const schema = s.object({
      users: s.array(
        s.object({
          name: s.string().default('User'),
          age: s.number().default(0)
        })
      ),
      metadata: s
        .object({
          version: s.number().default(1)
        })
        .optional()
    });

    const defaults = getDefaults(schema);
    expect(defaults.users).toEqual([]);
    expect('metadata' in defaults).toBe(false);
  });
});

describe('validate', () => {
  it('should delegate to schema.validate()', () => {
    const schema = s.string();
    expect(validate(schema, 'hello')).toBe(true);
    expect(validate(schema, 123)).toBe(false);
  });

  it('should return correct type predicate', () => {
    const schema = s.string();
    const value: unknown = 'hello';

    if (validate(schema, value)) {
      // TypeScript should know value is string here
      expect(typeof value).toBe('string');
    }
  });

  it('should work with all schema types', () => {
    expect(validate(s.string(), 'test')).toBe(true);
    expect(validate(s.number(), 42)).toBe(true);
    expect(validate(s.boolean(), true)).toBe(true);

    expect(
      validate(
        s.object({
          name: s.string()
        }),
        { name: 'test' }
      )
    ).toBe(true);

    expect(validate(s.array(s.string()), ['a', 'b'])).toBe(true);
  });
});

describe('hasDefault', () => {
  it('should return true when default is set', () => {
    expect(hasDefault(s.string().default('test'))).toBe(true);
    expect(hasDefault(s.number().default(42))).toBe(true);
    expect(hasDefault(s.boolean().default(true))).toBe(true);
  });

  it('should return false when no default', () => {
    expect(hasDefault(s.string())).toBe(false);
    expect(hasDefault(s.number())).toBe(false);
    expect(hasDefault(s.boolean())).toBe(false);
  });

  it('should work with all schema types', () => {
    expect(hasDefault(s.string().default('test'))).toBe(true);
    expect(
      hasDefault(
        s.object({
          name: s.string().default('test')
        })
      )
    ).toBe(false); // Object schema itself doesn't have default

    expect(
      hasDefault(
        s
          .object({
            name: s.string()
          })
          .default({ name: 'test' })
      )
    ).toBe(true);

    expect(hasDefault(s.array(s.string()).default(['test']))).toBe(true);
  });

  it('should return false for optional schemas without explicit default', () => {
    expect(hasDefault(s.string().optional())).toBe(false);
  });
});

describe('isOptional', () => {
  it('should return true for optional schemas', () => {
    expect(isOptional(s.string().optional())).toBe(true);
    expect(isOptional(s.number().optional())).toBe(true);
    expect(isOptional(s.boolean().optional())).toBe(true);
  });

  it('should return false for required schemas', () => {
    expect(isOptional(s.string())).toBe(false);
    expect(isOptional(s.number())).toBe(false);
    expect(isOptional(s.boolean())).toBe(false);
  });

  it('should work with all schema types', () => {
    expect(isOptional(s.string().optional())).toBe(true);
    expect(
      isOptional(
        s
          .object({
            name: s.string()
          })
          .optional()
      )
    ).toBe(true);

    expect(isOptional(s.array(s.string()).optional())).toBe(true);
    expect(isOptional(s.union([s.string(), s.number()]).optional())).toBe(true);
    expect(isOptional(s.record(s.string()).optional())).toBe(true);
  });

  it('should return false even if schema has default', () => {
    expect(isOptional(s.string().default('test'))).toBe(false);
    expect(isOptional(s.number().default(42))).toBe(false);
  });
});
