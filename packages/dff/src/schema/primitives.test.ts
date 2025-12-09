import { describe, expect, it } from 'vitest';
import {
  BooleanSchema,
  LiteralSchema,
  NumberSchema,
  StringSchema
} from './primitives';

describe('StringSchema', () => {
  describe('validate', () => {
    it('should validate string values correctly', () => {
      const schema = new StringSchema();
      expect(schema.validate('hello')).toBe(true);
      expect(schema.validate('')).toBe(true);
      expect(schema.validate('123')).toBe(true);
    });

    it('should reject non-string values', () => {
      const schema = new StringSchema();
      expect(schema.validate(123)).toBe(false);
      expect(schema.validate(true)).toBe(false);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate(undefined)).toBe(false);
      expect(schema.validate({})).toBe(false);
      expect(schema.validate([])).toBe(false);
    });

    it('should handle optional strings (accepts undefined)', () => {
      const schema = new StringSchema().optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate('hello')).toBe(true);
      expect(schema.validate('')).toBe(true);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate(123)).toBe(false);
    });
  });

  describe('default', () => {
    it('should set default values correctly', () => {
      const schema = new StringSchema().default('default-value');
      expect(schema.getDefault()).toBe('default-value');
    });

    it('should create new schema instance', () => {
      const schema1 = new StringSchema();
      const schema2 = schema1.default('test');
      expect(schema1).not.toBe(schema2);
      expect(schema2.getDefault()).toBe('test');
    });

    it('should throw when no default is set', () => {
      const schema = new StringSchema();
      expect(() => schema.getDefault()).toThrow();
    });

    it('should return undefined for optional schemas without default', () => {
      const schema = new StringSchema().optional();
      expect(schema.getDefault()).toBeUndefined();
    });
  });

  describe('optional', () => {
    it('should create new schema instance', () => {
      const schema1 = new StringSchema();
      const schema2 = schema1.optional();
      expect(schema1).not.toBe(schema2);
      expect(schema2._optional).toBe(true);
      expect(schema1._optional).toBe(false);
    });

    it('should preserve default when making optional', () => {
      const schema = new StringSchema().default('test').optional();
      expect(schema._optional).toBe(true);
      expect(schema.getDefault()).toBe('test');
    });
  });
});

describe('NumberSchema', () => {
  describe('validate', () => {
    it('should validate number values correctly', () => {
      const schema = new NumberSchema();
      expect(schema.validate(0)).toBe(true);
      expect(schema.validate(123)).toBe(true);
      expect(schema.validate(-456)).toBe(true);
      expect(schema.validate(3.14)).toBe(true);
    });

    it('should reject NaN values', () => {
      const schema = new NumberSchema();
      expect(schema.validate(Number.NaN)).toBe(false);
    });

    it('should reject non-number values', () => {
      const schema = new NumberSchema();
      expect(schema.validate('123')).toBe(false);
      expect(schema.validate(true)).toBe(false);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate(undefined)).toBe(false);
      expect(schema.validate({})).toBe(false);
      expect(schema.validate([])).toBe(false);
    });

    it('should handle optional numbers', () => {
      const schema = new NumberSchema().optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate(123)).toBe(true);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate('123')).toBe(false);
    });
  });

  describe('default', () => {
    it('should set default values correctly', () => {
      const schema = new NumberSchema().default(42);
      expect(schema.getDefault()).toBe(42);
    });

    it('should create new schema instance', () => {
      const schema1 = new NumberSchema();
      const schema2 = schema1.default(10);
      expect(schema1).not.toBe(schema2);
      expect(schema2.getDefault()).toBe(10);
    });

    it('should throw when no default is set', () => {
      const schema = new NumberSchema();
      expect(() => schema.getDefault()).toThrow();
    });

    it('should return undefined for optional schemas without default', () => {
      const schema = new NumberSchema().optional();
      expect(schema.getDefault()).toBeUndefined();
    });
  });
});

describe('BooleanSchema', () => {
  describe('validate', () => {
    it('should validate boolean values correctly', () => {
      const schema = new BooleanSchema();
      expect(schema.validate(true)).toBe(true);
      expect(schema.validate(false)).toBe(true);
    });

    it('should reject non-boolean values', () => {
      const schema = new BooleanSchema();
      expect(schema.validate(0)).toBe(false);
      expect(schema.validate(1)).toBe(false);
      expect(schema.validate('true')).toBe(false);
      expect(schema.validate('false')).toBe(false);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate(undefined)).toBe(false);
      expect(schema.validate({})).toBe(false);
      expect(schema.validate([])).toBe(false);
    });

    it('should handle optional booleans', () => {
      const schema = new BooleanSchema().optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate(true)).toBe(true);
      expect(schema.validate(false)).toBe(true);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate(1)).toBe(false);
    });
  });

  describe('default', () => {
    it('should set default values correctly', () => {
      const schema = new BooleanSchema().default(true);
      expect(schema.getDefault()).toBe(true);

      const schema2 = new BooleanSchema().default(false);
      expect(schema2.getDefault()).toBe(false);
    });

    it('should create new schema instance', () => {
      const schema1 = new BooleanSchema();
      const schema2 = schema1.default(true);
      expect(schema1).not.toBe(schema2);
      expect(schema2.getDefault()).toBe(true);
    });

    it('should throw when no default is set', () => {
      const schema = new BooleanSchema();
      expect(() => schema.getDefault()).toThrow();
    });

    it('should return undefined for optional schemas without default', () => {
      const schema = new BooleanSchema().optional();
      expect(schema.getDefault()).toBeUndefined();
    });
  });
});

describe('LiteralSchema', () => {
  describe('validate', () => {
    it('should validate exact literal matches for strings', () => {
      const schema = new LiteralSchema('hello');
      expect(schema.validate('hello')).toBe(true);
      expect(schema.validate('world')).toBe(false);
      expect(schema.validate('Hello')).toBe(false);
    });

    it('should validate exact literal matches for numbers', () => {
      const schema = new LiteralSchema(42);
      expect(schema.validate(42)).toBe(true);
      expect(schema.validate(43)).toBe(false);
      expect(schema.validate('42')).toBe(false);
    });

    it('should validate exact literal matches for booleans', () => {
      const schema = new LiteralSchema(true);
      expect(schema.validate(true)).toBe(true);
      expect(schema.validate(false)).toBe(false);
    });

    it('should reject non-matching values', () => {
      const schema = new LiteralSchema('test');
      expect(schema.validate('other')).toBe(false);
      expect(schema.validate(123)).toBe(false);
      expect(schema.validate(null)).toBe(false);
      expect(schema.validate(undefined)).toBe(false);
    });

    it('should handle optional literals', () => {
      const schema = new LiteralSchema('test').optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate('test')).toBe(true);
      expect(schema.validate('other')).toBe(false);
    });
  });

  describe('default', () => {
    it('should set default values correctly', () => {
      const schema = new LiteralSchema('hello');
      const schemaWithDefault = schema.default('hello');
      expect(schemaWithDefault.getDefault()).toBe('hello');
      // The literal value should still be 'hello'
      expect(schemaWithDefault.validate('hello')).toBe(true);
    });

    it('should create new schema instance', () => {
      const schema1 = new LiteralSchema('test');
      const schema2 = schema1.default('test');
      expect(schema1).not.toBe(schema2);
    });

    it('should throw when no default is set', () => {
      const schema = new LiteralSchema('test');
      expect(() => schema.getDefault()).toThrow();
    });

    it('should return undefined for optional schemas without default', () => {
      const schema = new LiteralSchema('test').optional();
      expect(schema.getDefault()).toBeUndefined();
    });
  });

  describe('works with different literal types', () => {
    it('should work with string literals', () => {
      const schema = new LiteralSchema('active');
      expect(schema.validate('active')).toBe(true);
    });

    it('should work with number literals', () => {
      const schema = new LiteralSchema(0);
      expect(schema.validate(0)).toBe(true);
    });

    it('should work with boolean literals', () => {
      const schema = new LiteralSchema(false);
      expect(schema.validate(false)).toBe(true);
    });

    it('should work with null literals', () => {
      const schema = new LiteralSchema(null);
      expect(schema.validate(null)).toBe(true);
      expect(schema.validate(undefined)).toBe(false);
      expect(schema.validate(0)).toBe(false);
      expect(schema.validate('null')).toBe(false);
    });
  });

  describe('nullable literals', () => {
    it('should validate null correctly', () => {
      const schema = new LiteralSchema(null);
      expect(schema.validate(null)).toBe(true);
      expect(schema.validate(undefined)).toBe(false);
      expect(schema.validate(0)).toBe(false);
      expect(schema.validate(false)).toBe(false);
    });

    it('should set null as default value', () => {
      const schema = new LiteralSchema(null).default(null);
      expect(schema.getDefault()).toBe(null);
      expect(schema.validate(null)).toBe(true);
    });

    it('should handle optional nullable literals', () => {
      const schema = new LiteralSchema(null).optional();
      expect(schema.validate(undefined)).toBe(true);
      expect(schema.validate(null)).toBe(true);
      expect(schema.validate(0)).toBe(false);
    });

    it('should work with unions containing null', () => {
      const schema = new LiteralSchema(null);
      expect(schema.validate(null)).toBe(true);
      // This tests that null can be used in unions
      expect(schema.validate('not-null')).toBe(false);
    });
  });
});
