import { describe, expect, it } from 'vitest';
import { s } from './index';

describe('ObjectSchema', () => {
  describe('validate', () => {
    it('should validate object shapes correctly', () => {
      const schema = s.object({
        name: s.string(),
        age: s.number()
      });

      expect(schema.validate({ name: 'John', age: 30 })).toBe(true);
      expect(schema.validate({ name: 'Jane', age: 25 })).toBe(true);
    });

    it('should validate nested objects', () => {
      const schema = s.object({
        user: s.object({
          name: s.string(),
          age: s.number()
        })
      });

      expect(
        schema.validate({
          user: { name: 'John', age: 30 }
        })
      ).toBe(true);
    });

    it('should handle missing required fields', () => {
      const schema = s.object({
        name: s.string(),
        age: s.number()
      });

      expect(schema.validate({ name: 'John' })).toBe(false);
      expect(schema.validate({ age: 30 })).toBe(false);
      expect(schema.validate({})).toBe(false);
    });

    it('should handle optional fields', () => {
      const schema = s.object({
        name: s.string(),
        age: s.number().optional()
      });

      expect(schema.validate({ name: 'John' })).toBe(true);
      expect(schema.validate({ name: 'John', age: 30 })).toBe(true);
      expect(schema.validate({ name: 'John', age: undefined })).toBe(true);
    });

    it('should handle fields with defaults', () => {
      const schema = s.object({
        name: s.string(),
        age: s.number().default(0)
      });

      // Fields with defaults are still required in the object
      // but validation should pass if they're missing (they'll use default)
      expect(schema.validate({ name: 'John' })).toBe(true);
      expect(schema.validate({ name: 'John', age: 30 })).toBe(true);
    });

    it('should reject non-object values', () => {
      const schema = s.object({
        name: s.string()
      });

      expect(schema.validate('not an object')).toBe(false);
      expect(schema.validate(123)).toBe(false);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate([])).toBe(false);
    });

    it('should handle optional object schema', () => {
      const schema = s.object({ name: s.string() }).optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate({ name: 'John' })).toBe(true);
      expect(schema.validate(null)).toBe(false);
    });
  });

  describe('getDefault', () => {
    it('should generate defaults from shape', () => {
      const schema = s.object({
        name: s.string().default('Unknown'),
        age: s.number().default(0)
      });

      const defaults = schema.getDefault();
      expect(defaults).toEqual({ name: 'Unknown', age: 0 });
    });

    it('should handle optional fields correctly', () => {
      const schema = s.object({
        name: s.string().default('Unknown'),
        age: s.number().optional()
      });

      const defaults = schema.getDefault();
      expect(defaults.name).toBe('Unknown');
      // Optional fields without defaults may be included as undefined
      // or excluded depending on implementation
      // The key is that validation should pass without them
    });

    it('should throw for required fields without defaults', () => {
      const schema = s.object({
        name: s.string(),
        age: s.number()
      });

      expect(() => schema.getDefault()).toThrow();
    });

    it('should return undefined for optional object schemas without default', () => {
      const schema = s.object({ name: s.string() }).optional();
      expect(schema.getDefault()).toBeUndefined();
    });

    it('should use explicit default when provided', () => {
      const schema = s
        .object({
          name: s.string()
        })
        .default({ name: 'Default Name' });

      expect(schema.getDefault()).toEqual({ name: 'Default Name' });
    });
  });

  describe('default and optional', () => {
    it('should create new schema instance with default', () => {
      const schema1 = s.object({ name: s.string() });
      const schema2 = schema1.default({ name: 'Test' });
      expect(schema1).not.toBe(schema2);
      expect(schema2.getDefault()).toEqual({ name: 'Test' });
    });

    it('should create new schema instance with optional', () => {
      const schema1 = s.object({ name: s.string() });
      const schema2 = schema1.optional();
      expect(schema1).not.toBe(schema2);
      expect(schema2._optional).toBe(true);
    });
  });
});

describe('ArraySchema', () => {
  describe('validate', () => {
    it('should validate arrays of correct item type', () => {
      const schema = s.array(s.string());
      expect(schema.validate(['a', 'b', 'c'])).toBe(true);
      expect(schema.validate([])).toBe(true);
    });

    it('should reject non-array values', () => {
      const schema = s.array(s.string());
      expect(schema.validate('not an array')).toBe(false);
      expect(schema.validate(123)).toBe(false);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate({})).toBe(false);
    });

    it('should reject arrays with invalid items', () => {
      const schema = s.array(s.string());
      expect(schema.validate(['a', 123, 'c'])).toBe(false);
      expect(schema.validate([true, false])).toBe(false);
    });

    it('should handle empty arrays', () => {
      const schema = s.array(s.string());
      expect(schema.validate([])).toBe(true);
    });

    it('should handle optional arrays', () => {
      const schema = s.array(s.string()).optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate(['a', 'b'])).toBe(true);
      expect(schema.validate(null)).toBe(false);
    });

    it('should validate arrays of objects', () => {
      const schema = s.array(
        s.object({
          name: s.string(),
          age: s.number()
        })
      );

      expect(
        schema.validate([
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ])
      ).toBe(true);
    });
  });

  describe('default', () => {
    it('should set default values correctly', () => {
      const schema = s.array(s.string()).default(['a', 'b']);
      expect(schema.getDefault()).toEqual(['a', 'b']);
    });

    it('should return empty array when no default set', () => {
      const schema = s.array(s.string());
      expect(schema.getDefault()).toEqual([]);
    });

    it('should return undefined for optional arrays without default', () => {
      const schema = s.array(s.string()).optional();
      expect(schema.getDefault()).toBeUndefined();
    });
  });

  describe('default and optional', () => {
    it('should create new schema instance', () => {
      const schema1 = s.array(s.string());
      const schema2 = schema1.default(['test']);
      expect(schema1).not.toBe(schema2);
    });
  });
});

describe('UnionSchema', () => {
  describe('validate', () => {
    it('should validate values matching any schema', () => {
      const schema = s.union([s.string(), s.number()]);
      expect(schema.validate('hello')).toBe(true);
      expect(schema.validate(123)).toBe(true);
    });

    it('should reject values matching none', () => {
      const schema = s.union([s.string(), s.number()]);
      expect(schema.validate(true)).toBe(false);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate({})).toBe(false);
    });

    it('should handle optional unions', () => {
      const schema = s.union([s.string(), s.number()]).optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate('hello')).toBe(true);
      expect(schema.validate(123)).toBe(true);
    });

    it('should work with literal unions', () => {
      const schema = s.union([s.literal('a'), s.literal('b'), s.literal('c')]);
      expect(schema.validate('a')).toBe(true);
      expect(schema.validate('b')).toBe(true);
      expect(schema.validate('c')).toBe(true);
      expect(schema.validate('d')).toBe(false);
    });
  });

  describe('default', () => {
    it('should set default values correctly', () => {
      const schema = s.union([s.string(), s.number()]).default('default');
      expect(schema.getDefault()).toBe('default');
    });

    it('should try first schema for default', () => {
      const schema = s.union([
        s.string().default('first'),
        s.number().default(42)
      ]);
      expect(schema.getDefault()).toBe('first');
    });

    it('should throw when no default available', () => {
      const schema = s.union([s.string(), s.number()]);
      expect(() => schema.getDefault()).toThrow();
    });

    it('should return undefined for optional unions without default', () => {
      const schema = s.union([s.string(), s.number()]).optional();
      expect(schema.getDefault()).toBeUndefined();
    });
  });
});

describe('RecordSchema', () => {
  describe('validate', () => {
    it('should validate objects with dynamic keys', () => {
      const schema = s.record(s.string());
      expect(schema.validate({ a: 'hello', b: 'world' })).toBe(true);
      expect(schema.validate({})).toBe(true);
    });

    it('should validate all values match value schema', () => {
      const schema = s.record(s.number());
      expect(schema.validate({ a: 1, b: 2, c: 3 })).toBe(true);
      expect(schema.validate({ a: 1, b: 'invalid' })).toBe(false);
    });

    it('should reject non-object values', () => {
      const schema = s.record(s.string());
      expect(schema.validate('not an object')).toBe(false);
      expect(schema.validate(123)).toBe(false);
      expect(schema.validate(null)).toBe(false);
    });

    it('should reject arrays', () => {
      const schema = s.record(s.string());
      expect(schema.validate([])).toBe(false);
    });

    it('should handle empty records', () => {
      const schema = s.record(s.string());
      expect(schema.validate({})).toBe(true);
    });

    it('should handle optional records', () => {
      const schema = s.record(s.string()).optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate({ a: 'hello' })).toBe(true);
      expect(schema.validate(null)).toBe(false);
    });

    it('should work with complex value schemas', () => {
      const schema = s.record(
        s.object({
          name: s.string(),
          age: s.number()
        })
      );

      expect(
        schema.validate({
          user1: { name: 'John', age: 30 },
          user2: { name: 'Jane', age: 25 }
        })
      ).toBe(true);
    });
  });

  describe('default', () => {
    it('should set default values correctly', () => {
      const schema = s.record(s.string()).default({ a: 'hello' });
      expect(schema.getDefault()).toEqual({ a: 'hello' });
    });

    it('should return empty object when no default set', () => {
      const schema = s.record(s.string());
      expect(schema.getDefault()).toEqual({});
    });

    it('should return undefined for optional records without default', () => {
      const schema = s.record(s.string()).optional();
      expect(schema.getDefault()).toBeUndefined();
    });
  });
});
