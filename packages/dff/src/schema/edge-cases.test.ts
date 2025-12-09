import { describe, expect, it } from 'vitest';
import { s } from './index';
import { validate } from './utils';

describe('Edge Cases: Null values', () => {
  it('should reject null for string schema', () => {
    const schema = s.string();
    expect(validate(schema, null)).toBe(false);
  });

  it('should reject null for number schema', () => {
    const schema = s.number();
    expect(validate(schema, null)).toBe(false);
  });

  it('should reject null for boolean schema', () => {
    const schema = s.boolean();
    expect(validate(schema, null)).toBe(false);
  });

  it('should reject null for object schema', () => {
    const schema = s.object({ name: s.string() });
    expect(validate(schema, null)).toBe(false);
  });

  it('should reject null for array schema', () => {
    const schema = s.array(s.string());
    expect(validate(schema, null)).toBe(false);
  });

  it('should reject null even for optional schemas', () => {
    const schema = s.string().optional();
    expect(validate(schema, null)).toBe(false);
    expect(validate(schema, undefined)).toBe(true);
  });
});

describe('Edge Cases: Undefined handling', () => {
  it('should reject undefined for required schemas', () => {
    expect(validate(s.string(), undefined)).toBe(false);
    expect(validate(s.number(), undefined)).toBe(false);
    expect(validate(s.boolean(), undefined)).toBe(false);
  });

  it('should accept undefined for optional schemas', () => {
    expect(validate(s.string().optional(), undefined)).toBe(true);
    expect(validate(s.number().optional(), undefined)).toBe(true);
    expect(validate(s.boolean().optional(), undefined)).toBe(true);
  });

  it('should handle undefined in optional object fields', () => {
    const schema = s.object({
      name: s.string(),
      age: s.number().optional()
    });

    expect(validate(schema, { name: 'John', age: undefined })).toBe(true);
    expect(validate(schema, { name: 'John' })).toBe(true);
  });

  it('should handle undefined in optional nested objects', () => {
    const schema = s.object({
      user: s
        .object({
          name: s.string()
        })
        .optional()
    });

    expect(validate(schema, { user: undefined })).toBe(true);
    expect(validate(schema, {})).toBe(true);
  });
});

describe('Edge Cases: Empty values', () => {
  it('should accept empty strings', () => {
    const schema = s.string();
    expect(validate(schema, '')).toBe(true);
  });

  it('should accept empty arrays', () => {
    const schema = s.array(s.string());
    expect(validate(schema, [])).toBe(true);
  });

  it('should accept empty objects', () => {
    const schema = s.object({});
    expect(validate(schema, {})).toBe(true);
  });

  it('should accept empty records', () => {
    const schema = s.record(s.string());
    expect(validate(schema, {})).toBe(true);
  });

  it('should handle arrays with empty strings', () => {
    const schema = s.array(s.string());
    expect(validate(schema, ['', 'hello', ''])).toBe(true);
  });
});

describe('Edge Cases: Deeply nested structures', () => {
  it('should handle deeply nested objects', () => {
    const schema = s.object({
      level1: s.object({
        level2: s.object({
          level3: s.object({
            level4: s.object({
              value: s.string()
            })
          })
        })
      })
    });

    const data = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'deep'
            }
          }
        }
      }
    };

    expect(validate(schema, data)).toBe(true);
  });

  it('should handle nested arrays', () => {
    const schema = s.array(s.array(s.string()));
    expect(
      validate(schema, [
        ['a', 'b'],
        ['c', 'd']
      ])
    ).toBe(true);
    expect(validate(schema, [[], ['a']])).toBe(true);
  });

  it('should handle arrays of nested objects', () => {
    const schema = s.array(
      s.object({
        items: s.array(
          s.object({
            name: s.string(),
            value: s.number()
          })
        )
      })
    );

    const data = [
      {
        items: [
          { name: 'a', value: 1 },
          { name: 'b', value: 2 }
        ]
      }
    ];

    expect(validate(schema, data)).toBe(true);
  });
});

describe('Edge Cases: Special number values', () => {
  it('should reject NaN', () => {
    const schema = s.number();
    expect(validate(schema, Number.NaN)).toBe(false);
  });

  it('should accept Infinity', () => {
    const schema = s.number();
    expect(validate(schema, Number.POSITIVE_INFINITY)).toBe(true);
    expect(validate(schema, Number.NEGATIVE_INFINITY)).toBe(true);
  });

  it('should accept zero', () => {
    const schema = s.number();
    expect(validate(schema, 0)).toBe(true);
    expect(validate(schema, -0)).toBe(true);
  });

  it('should accept very large numbers', () => {
    const schema = s.number();
    expect(validate(schema, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(validate(schema, Number.MIN_SAFE_INTEGER)).toBe(true);
  });
});

describe('Edge Cases: Type coercion attempts', () => {
  it('should not coerce string numbers', () => {
    const schema = s.number();
    expect(validate(schema, '123')).toBe(false);
    expect(validate(schema, '0')).toBe(false);
  });

  it('should not coerce number strings', () => {
    const schema = s.string();
    expect(validate(schema, 123)).toBe(false);
  });

  it('should not coerce truthy/falsy to boolean', () => {
    const schema = s.boolean();
    expect(validate(schema, 0)).toBe(false);
    expect(validate(schema, 1)).toBe(false);
    expect(validate(schema, '')).toBe(false);
    expect(validate(schema, 'true')).toBe(false);
  });

  it('should not coerce objects to arrays', () => {
    const schema = s.array(s.string());
    expect(validate(schema, { 0: 'a', 1: 'b' })).toBe(false);
  });

  it('should not coerce arrays to objects', () => {
    const schema = s.object({ name: s.string() });
    expect(validate(schema, ['a', 'b'])).toBe(false);
  });
});

describe('Edge Cases: Union schema edge cases', () => {
  it('should handle union with overlapping types', () => {
    const schema = s.union([s.literal(1), s.literal(2), s.number()]);
    expect(validate(schema, 1)).toBe(true);
    expect(validate(schema, 2)).toBe(true);
    expect(validate(schema, 3)).toBe(true);
    expect(validate(schema, '1')).toBe(false);
  });

  it('should handle empty union (should not validate anything)', () => {
    const schema = s.union([]);
    expect(validate(schema, 'anything')).toBe(false);
    expect(validate(schema, 123)).toBe(false);
    expect(validate(schema, true)).toBe(false);
  });

  it('should handle union with all optional schemas', () => {
    const schema = s.union([s.string().optional(), s.number().optional()]);
    // Union itself is not optional, so undefined should not pass
    expect(validate(schema, undefined)).toBe(false);
    expect(validate(schema, 'hello')).toBe(true);
  });
});

describe('Edge Cases: Record schema edge cases', () => {
  it('should handle record with numeric string keys', () => {
    const schema = s.record(s.string());
    expect(validate(schema, { '0': 'a', '1': 'b' })).toBe(true);
  });

  it('should handle record with special characters in keys', () => {
    const schema = s.record(s.string());
    expect(validate(schema, { 'key-with-dash': 'value' })).toBe(true);
    expect(validate(schema, { 'key.with.dots': 'value' })).toBe(true);
    expect(validate(schema, { key_with_underscore: 'value' })).toBe(true);
  });

  it('should handle record with empty string keys', () => {
    const schema = s.record(s.string());
    expect(validate(schema, { '': 'empty key' })).toBe(true);
  });
});

describe('Edge Cases: Array schema edge cases', () => {
  it('should handle arrays with many items', () => {
    const schema = s.array(s.number());
    const largeArray = Array.from({ length: 1000 }, (_, i) => i);
    expect(validate(schema, largeArray)).toBe(true);
  });

  it('should handle arrays with mixed valid and invalid items (should fail)', () => {
    const schema = s.array(s.string());
    expect(validate(schema, ['a', 123, 'b'])).toBe(false);
  });

  it('should handle sparse arrays', () => {
    const schema = s.array(s.string());
    const sparseArray = ['a'];
    sparseArray[10] = 'b';
    // Note: sparse arrays still have undefined values at missing indices
    // This should fail validation
    expect(validate(schema, sparseArray)).toBe(false);
  });
});

describe('Edge Cases: Object schema edge cases', () => {
  it('should handle objects with extra properties (should still validate)', () => {
    const schema = s.object({
      name: s.string()
    });
    // Extra properties don't cause validation to fail
    expect(validate(schema, { name: 'John', extra: 'property' })).toBe(true);
  });

  it('should handle objects with prototype properties', () => {
    const schema = s.object({
      name: s.string()
    });
    const obj = Object.create({ inherited: 'property' });
    obj.name = 'John';
    expect(validate(schema, obj)).toBe(true);
  });

  it('should handle objects with null prototype', () => {
    const schema = s.object({
      name: s.string()
    });
    const obj = Object.create(null);
    obj.name = 'John';
    expect(validate(schema, obj)).toBe(true);
  });
});

describe('Edge Cases: Error messages', () => {
  it('should throw meaningful error for getDefault without default', () => {
    const schema = s.string();
    expect(() => schema.getDefault()).toThrow('No default value set');
  });

  it('should throw meaningful error for object with missing required field', () => {
    const schema = s.object({
      name: s.string(),
      age: s.number()
    });
    expect(() => schema.getDefault()).toThrow(
      'No default value for required field'
    );
  });
});
