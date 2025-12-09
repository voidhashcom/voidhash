import { describe, expect, it } from 'vitest';
import { type Infer, s } from './index';
import { validate } from './utils';

describe('Integration: Complex nested schemas', () => {
  it('should handle objects with arrays', () => {
    const schema = s.object({
      tags: s.array(s.string()),
      numbers: s.array(s.number())
    });

    expect(
      validate(schema, {
        tags: ['a', 'b', 'c'],
        numbers: [1, 2, 3]
      })
    ).toBe(true);

    expect(
      validate(schema, {
        tags: ['a'],
        numbers: ['invalid']
      })
    ).toBe(false);
  });

  it('should handle arrays of objects', () => {
    const schema = s.array(
      s.object({
        id: s.string(),
        name: s.string(),
        age: s.number()
      })
    );

    expect(
      validate(schema, [
        { id: '1', name: 'John', age: 30 },
        { id: '2', name: 'Jane', age: 25 }
      ])
    ).toBe(true);

    expect(
      validate(schema, [
        { id: '1', name: 'John' } // missing age
      ])
    ).toBe(false);
  });

  it('should handle deeply nested structures', () => {
    const schema = s.object({
      users: s.array(
        s.object({
          profile: s.object({
            name: s.string(),
            email: s.string()
          }),
          roles: s.array(s.string())
        })
      )
    });

    expect(
      validate(schema, {
        users: [
          {
            profile: { name: 'John', email: 'john@example.com' },
            roles: ['admin', 'user']
          }
        ]
      })
    ).toBe(true);
  });

  it('should handle mixed optional and required fields', () => {
    const schema = s.object({
      id: s.string(),
      name: s.string(),
      email: s.string().optional(),
      age: s.number().default(0),
      tags: s.array(s.string()).optional()
    });

    expect(
      validate(schema, {
        id: '1',
        name: 'John'
      })
    ).toBe(true);

    expect(
      validate(schema, {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        age: 30,
        tags: ['admin']
      })
    ).toBe(true);
  });
});

describe('Integration: Schema builder s object', () => {
  it('should create string schemas', () => {
    const schema = s.string();
    expect(validate(schema, 'hello')).toBe(true);
    expect(validate(schema, 123)).toBe(false);
  });

  it('should create number schemas', () => {
    const schema = s.number();
    expect(validate(schema, 42)).toBe(true);
    expect(validate(schema, '42')).toBe(false);
  });

  it('should create boolean schemas', () => {
    const schema = s.boolean();
    expect(validate(schema, true)).toBe(true);
    expect(validate(schema, false)).toBe(true);
    expect(validate(schema, 1)).toBe(false);
  });

  it('should create literal schemas', () => {
    const schema = s.literal('active');
    expect(validate(schema, 'active')).toBe(true);
    expect(validate(schema, 'inactive')).toBe(false);
  });

  it('should create object schemas', () => {
    const schema = s.object({
      name: s.string(),
      age: s.number()
    });
    expect(validate(schema, { name: 'John', age: 30 })).toBe(true);
  });

  it('should create array schemas', () => {
    const schema = s.array(s.string());
    expect(validate(schema, ['a', 'b'])).toBe(true);
  });

  it('should create union schemas', () => {
    const schema = s.union([s.string(), s.number()]);
    expect(validate(schema, 'hello')).toBe(true);
    expect(validate(schema, 123)).toBe(true);
    expect(validate(schema, true)).toBe(false);
  });

  it('should create record schemas', () => {
    const schema = s.record(s.number());
    expect(validate(schema, { a: 1, b: 2 })).toBe(true);
  });
});

describe('Integration: Type inference', () => {
  it('should infer types correctly for simple schemas', () => {
    const stringSchema = s.string();
    type StringType = Infer<typeof stringSchema>;
    const _test: StringType = 'hello';
    expect(_test).toBe('hello');
  });

  it('should infer types correctly for object schemas', () => {
    const personSchema = s.object({
      name: s.string(),
      age: s.number(),
      active: s.boolean()
    });

    type Person = Infer<typeof personSchema>;
    const person: Person = {
      name: 'John',
      age: 30,
      active: true
    };

    expect(person.name).toBe('John');
    expect(person.age).toBe(30);
    expect(person.active).toBe(true);
  });

  it('should infer types correctly for nested schemas', () => {
    const schema = s.object({
      user: s.object({
        name: s.string(),
        age: s.number()
      }),
      tags: s.array(s.string())
    });

    type SchemaType = Infer<typeof schema>;
    const data: SchemaType = {
      user: { name: 'John', age: 30 },
      tags: ['admin', 'user']
    };

    expect(data.user.name).toBe('John');
    expect(data.tags).toEqual(['admin', 'user']);
  });

  it('should infer optional types correctly', () => {
    const schema = s.object({
      name: s.string(),
      email: s.string().optional()
    });

    type SchemaType = Infer<typeof schema>;
    const withEmail: SchemaType = {
      name: 'John',
      email: 'john@example.com'
    };
    const withoutEmail: SchemaType = {
      name: 'John',
      email: undefined
    };

    expect(withEmail.email).toBe('john@example.com');
    expect(withoutEmail.email).toBeUndefined();
  });
});

describe('Integration: Real-world usage scenarios', () => {
  it('should work with a user profile schema', () => {
    const userSchema = s.object({
      id: s.string(),
      name: s.string(),
      email: s.string().optional(),
      age: s.number().default(0),
      roles: s.array(s.string()).default([]),
      metadata: s.record(s.string()).optional()
    });

    const validUser = {
      id: '1',
      name: 'John',
      email: 'john@example.com',
      age: 30,
      roles: ['admin'],
      metadata: { department: 'Engineering' }
    };

    expect(validate(userSchema, validUser)).toBe(true);

    const minimalUser = {
      id: '2',
      name: 'Jane'
    };

    expect(validate(userSchema, minimalUser)).toBe(true);

    // Cannot call getDefaults on schema with required fields without defaults
    // Instead, test that validation works with minimal data
    expect(validate(userSchema, minimalUser)).toBe(true);
  });

  it('should work with a form data schema', () => {
    const formSchema = s.object({
      title: s.string(),
      description: s.string().optional(),
      status: s.union([s.literal('draft'), s.literal('published')]),
      tags: s.array(s.string()).default([]),
      settings: s
        .object({
          public: s.boolean().default(false),
          featured: s.boolean().default(false)
        })
        .optional()
    });

    const formData = {
      title: 'My Post',
      description: 'A description',
      status: 'draft' as const,
      tags: ['tech', 'blog'],
      settings: {
        public: true,
        featured: false
      }
    };

    expect(validate(formSchema, formData)).toBe(true);

    const minimalFormData = {
      title: 'Another Post',
      status: 'published' as const
    };

    expect(validate(formSchema, minimalFormData)).toBe(true);
  });

  it('should work with a configuration schema', () => {
    const configSchema = s.object({
      app: s.object({
        name: s.string(),
        version: s.string(),
        debug: s.boolean().default(false)
      }),
      features: s.record(s.boolean()).default({}),
      servers: s.array(
        s.object({
          host: s.string(),
          port: s.number(),
          ssl: s.boolean().default(false)
        })
      )
    });

    const config = {
      app: {
        name: 'MyApp',
        version: '1.0.0',
        debug: true
      },
      features: {
        feature1: true,
        feature2: false
      },
      servers: [
        { host: 'localhost', port: 3000, ssl: false },
        { host: 'api.example.com', port: 443, ssl: true }
      ]
    };

    expect(validate(configSchema, config)).toBe(true);
  });
});
