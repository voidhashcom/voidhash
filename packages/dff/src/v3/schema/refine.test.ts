import { describe, expect, it } from 'vitest';
import { s } from './index';
import { validate } from './utils';

const AZ_REGEX = /[A-Z]/;
const ZERO_TO_NINE_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;
const LOWERCASE_REGEX = /[a-z]/;
describe('refine: Primitive Schemas', () => {
  describe('StringSchema', () => {
    it('should apply refinement after base validation', () => {
      const schema = s.string().refine((val) => val.length > 5);
      expect(validate(schema, 'hello')).toBe(false);
      expect(validate(schema, 'hello world')).toBe(true);
    });

    it('should reject non-string values before refinement', () => {
      const schema = s.string().refine((val) => val.includes('@'));
      expect(validate(schema, 123)).toBe(false);
      expect(validate(schema, 'test')).toBe(false);
      expect(validate(schema, 'test@example.com')).toBe(true);
    });

    it('should support multiple refinements', () => {
      const schema = s
        .string()
        .refine((val) => val.length >= 8, 'Must be at least 8 characters')
        .refine((val) => AZ_REGEX.test(val), 'Must contain uppercase')
        .refine((val) => ZERO_TO_NINE_REGEX.test(val), 'Must contain number');

      expect(validate(schema, 'short')).toBe(false);
      expect(validate(schema, 'toolong')).toBe(false);
      expect(validate(schema, 'TOOLONG')).toBe(false);
      expect(validate(schema, 'TOOLONG1')).toBe(true);
    });

    it('should support error messages', () => {
      const schema = s
        .string()
        .refine((val) => val.includes('@'), 'Must be a valid email');
      // Message is stored internally - just verify refinement works
      expect(validate(schema, 'test@example.com')).toBe(true);
      expect(validate(schema, 'invalid')).toBe(false);
    });

    it('should support error messages as object', () => {
      const schema = s.string().refine((val) => val.length > 0, {
        message: 'Cannot be empty'
      });
      // Message is stored internally - just verify refinement works
      expect(validate(schema, 'hello')).toBe(true);
      expect(validate(schema, '')).toBe(false);
    });

    it('should work with optional strings', () => {
      const schema = s
        .string()
        .optional()
        .refine((val) => val === undefined || val.length > 0);
      // For optional schemas, undefined passes base validation
      // Then refinement checks if it's undefined OR has length > 0
      expect(validate(schema, undefined)).toBe(true);
      expect(validate(schema, '')).toBe(false);
      expect(validate(schema, 'hello')).toBe(true);
    });
  });

  describe('NumberSchema', () => {
    it('should apply refinement after base validation', () => {
      const schema = s.number().refine((val) => val > 0);
      expect(validate(schema, -5)).toBe(false);
      expect(validate(schema, 0)).toBe(false);
      expect(validate(schema, 10)).toBe(true);
    });

    it('should reject non-number values before refinement', () => {
      const schema = s.number().refine((val) => val % 2 === 0);
      expect(validate(schema, '10')).toBe(false);
      expect(validate(schema, 5)).toBe(false);
      expect(validate(schema, 10)).toBe(true);
    });

    it('should support multiple refinements', () => {
      const schema = s
        .number()
        .refine((val) => val >= 0, 'Must be non-negative')
        .refine((val) => val <= 100, 'Must be at most 100');

      expect(validate(schema, -1)).toBe(false);
      expect(validate(schema, 101)).toBe(false);
      expect(validate(schema, 50)).toBe(true);
    });
  });

  describe('BooleanSchema', () => {
    it('should apply refinement after base validation', () => {
      // Example: require true values only
      const schema = s.boolean().refine((val) => val === true);
      expect(validate(schema, false)).toBe(false);
      expect(validate(schema, true)).toBe(true);
    });
  });

  describe('LiteralSchema', () => {
    it('should apply refinement after base validation', () => {
      const schema = s.literal('active').refine((val) => val === 'active');
      expect(validate(schema, 'inactive')).toBe(false);
      expect(validate(schema, 'active')).toBe(true);
    });
  });
});

describe('refine: Complex Schemas', () => {
  describe('ObjectSchema', () => {
    it('should validate property combinations', () => {
      const schema = s
        .object({
          password: s.string(),
          confirmPassword: s.string()
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'Passwords must match'
        });

      expect(
        validate(schema, {
          password: 'secret',
          confirmPassword: 'different'
        })
      ).toBe(false);

      expect(
        validate(schema, {
          password: 'secret',
          confirmPassword: 'secret'
        })
      ).toBe(true);
    });

    it('should apply refinement after shape validation', () => {
      const schema = s
        .object({
          start: s.number(),
          end: s.number()
        })
        .refine((data) => data.start < data.end, 'Start must be before end');

      // Should fail shape validation first
      expect(validate(schema, { start: 10 })).toBe(false);

      // Should fail refinement
      expect(validate(schema, { start: 10, end: 5 })).toBe(false);

      // Should pass
      expect(validate(schema, { start: 5, end: 10 })).toBe(true);
    });

    it('should support multiple refinements', () => {
      const schema = s
        .object({
          age: s.number(),
          email: s.string()
        })
        .refine((data) => data.age >= 18, 'Must be 18 or older')
        .refine((data) => data.email.includes('@'), 'Must be valid email');

      expect(validate(schema, { age: 16, email: 'test@example.com' })).toBe(
        false
      );
      expect(validate(schema, { age: 20, email: 'invalid' })).toBe(false);
      expect(validate(schema, { age: 20, email: 'test@example.com' })).toBe(
        true
      );
    });

    it('should work with nested objects', () => {
      const schema = s
        .object({
          user: s.object({
            name: s.string(),
            age: s.number()
          })
        })
        .refine((data) => data.user.age >= 0, 'Age must be non-negative');

      expect(
        validate(schema, {
          user: { name: 'John', age: -5 }
        })
      ).toBe(false);

      expect(
        validate(schema, {
          user: { name: 'John', age: 25 }
        })
      ).toBe(true);
    });
  });

  describe('ArraySchema', () => {
    it('should validate array-level constraints', () => {
      const schema = s
        .array(s.string())
        .refine((arr) => arr.length > 0, 'Array cannot be empty');

      expect(validate(schema, [])).toBe(false);
      expect(validate(schema, ['a', 'b'])).toBe(true);
    });

    it('should apply refinement after item validation', () => {
      const schema = s
        .array(s.string())
        .refine((arr) => arr.length <= 10, 'Array cannot exceed 10 items');

      // Should fail item validation first
      expect(validate(schema, [1, 2, 3])).toBe(false);

      // Should fail refinement
      expect(
        validate(
          schema,
          Array.from({ length: 11 }, (_, i) => `item${i}`)
        )
      ).toBe(false);

      // Should pass
      expect(validate(schema, ['a', 'b', 'c'])).toBe(true);
    });

    it('should support multiple refinements', () => {
      const schema = s
        .array(s.number())
        .refine((arr) => arr.length > 0, 'Cannot be empty')
        .refine(
          (arr) => arr.every((n) => n > 0),
          'All numbers must be positive'
        )
        .refine((arr) => arr.length <= 5, 'Cannot exceed 5 items');

      expect(validate(schema, [])).toBe(false);
      expect(validate(schema, [-1, 2, 3])).toBe(false);
      expect(validate(schema, [1, 2, 3, 4, 5, 6])).toBe(false);
      expect(validate(schema, [1, 2, 3])).toBe(true);
    });
  });

  describe('UnionSchema', () => {
    it('should apply refinement after union matching', () => {
      const schema = s.union([s.string(), s.number()]).refine((val) => {
        if (typeof val === 'string') {
          return val.length > 0;
        }
        return val > 0;
      });

      // Should fail union matching first
      expect(validate(schema, true)).toBe(false);

      // Should fail refinement
      expect(validate(schema, '')).toBe(false);
      expect(validate(schema, -5)).toBe(false);

      // Should pass
      expect(validate(schema, 'hello')).toBe(true);
      expect(validate(schema, 10)).toBe(true);
    });
  });

  describe('RecordSchema', () => {
    it('should validate record-level constraints', () => {
      const schema = s
        .record(s.number())
        .refine((record) => Object.keys(record).length > 0, 'Cannot be empty');

      expect(validate(schema, {})).toBe(false);
      expect(validate(schema, { a: 1, b: 2 })).toBe(true);
    });

    it('should apply refinement after value validation', () => {
      const schema = s
        .record(s.string())
        .refine(
          (record) => Object.values(record).every((v) => v.length > 0),
          'All values must be non-empty'
        );

      // Should fail value validation first
      expect(validate(schema, { a: 1 })).toBe(false);

      // Should fail refinement
      expect(validate(schema, { a: '', b: 'hello' })).toBe(false);

      // Should pass
      expect(validate(schema, { a: 'hello', b: 'world' })).toBe(true);
    });
  });
});

describe('refine: Chaining and Immutability', () => {
  it('should create new schema instance', () => {
    const schema1 = s.string();
    const schema2 = schema1.refine((val) => val.length > 0);
    expect(schema1).not.toBe(schema2);
    // Verify refinement is applied
    expect(validate(schema1, '')).toBe(true); // No refinement
    expect(validate(schema2, '')).toBe(false); // Has refinement
  });

  it('should preserve existing refinements when chaining', () => {
    const schema = s
      .string()
      .refine((val) => val.length >= 8)
      .refine((val) => AZ_REGEX.test(val))
      .refine((val) => ZERO_TO_NINE_REGEX.test(val));

    // Verify all refinements are applied
    expect(validate(schema, 'short')).toBe(false); // length
    expect(validate(schema, 'toolong')).toBe(false); // uppercase
    expect(validate(schema, 'TOOLONG')).toBe(false); // number
    expect(validate(schema, 'TOOLONG1')).toBe(true); // all pass
  });

  it('should preserve defaults and optional when refining', () => {
    const schema1 = s.string().default('test').optional();
    // Refinement that allows undefined or non-empty strings
    const schema2 = schema1.refine(
      (val) => val === undefined || val.length > 0
    );

    expect(schema2._default).toBe('test');
    expect(schema2._optional).toBe(true);
    // Verify refinement works - undefined passes, empty string fails
    expect(validate(schema2, undefined)).toBe(true);
    expect(validate(schema2, '')).toBe(false);
    expect(validate(schema2, 'hello')).toBe(true);
  });
});

describe('refine: Real-world Examples', () => {
  it('should validate email format', () => {
    const emailSchema = s
      .string()
      .refine((val) => val.includes('@'), 'Must contain @')
      .refine((val) => val.includes('.'), 'Must contain .')
      .refine((val) => val.length > 5, 'Must be at least 6 characters');

    expect(validate(emailSchema, 'invalid')).toBe(false);
    expect(validate(emailSchema, 'test@')).toBe(false);
    expect(validate(emailSchema, 'test@example')).toBe(false);
    expect(validate(emailSchema, 'test@example.com')).toBe(true);
  });

  it('should validate password strength', () => {
    const passwordSchema = s
      .string()
      .refine((val) => val.length >= 8, 'Must be at least 8 characters')
      .refine((val) => AZ_REGEX.test(val), 'Must contain uppercase letter')
      .refine(
        (val) => LOWERCASE_REGEX.test(val),
        'Must contain lowercase letter'
      )
      .refine((val) => ZERO_TO_NINE_REGEX.test(val), 'Must contain number')
      .refine(
        (val) => SPECIAL_CHAR_REGEX.test(val),
        'Must contain special character'
      );

    expect(validate(passwordSchema, 'short')).toBe(false);
    expect(validate(passwordSchema, 'alllowercase123')).toBe(false);
    expect(validate(passwordSchema, 'ALLUPPERCASE123')).toBe(false);
    expect(validate(passwordSchema, 'NoSpecial123')).toBe(false);
    expect(validate(passwordSchema, 'ValidPass123!')).toBe(true);
  });

  it('should validate date ranges', () => {
    const dateRangeSchema = s
      .object({
        start: s.number(),
        end: s.number()
      })
      .refine(
        (data) => data.start <= data.end,
        'Start must be before or equal to end'
      )
      .refine(
        (data) => data.end - data.start <= 365,
        'Range cannot exceed 365 days'
      );

    expect(validate(dateRangeSchema, { start: 100, end: 50 })).toBe(false);
    expect(validate(dateRangeSchema, { start: 0, end: 400 })).toBe(false);
    expect(validate(dateRangeSchema, { start: 0, end: 100 })).toBe(true);
  });

  it('should validate form data with cross-field validation', () => {
    const formSchema = s
      .object({
        password: s.string(),
        confirmPassword: s.string(),
        age: s.number()
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords must match'
      })
      .refine((data) => data.age >= 18, 'Must be 18 or older');

    expect(
      validate(formSchema, {
        password: 'secret',
        confirmPassword: 'different',
        age: 20
      })
    ).toBe(false);

    expect(
      validate(formSchema, {
        password: 'secret',
        confirmPassword: 'secret',
        age: 16
      })
    ).toBe(false);

    expect(
      validate(formSchema, {
        password: 'secret',
        confirmPassword: 'secret',
        age: 20
      })
    ).toBe(true);
  });
});
