import { s } from '../schema';
import { variableTypeSchema } from '../variables';
import { variableReferenceSchema } from '../variables/variables';

// Operand: a value that can be compared (literal or variable reference)
const operandSchema = s.union([
  s.object({
    type: s.literal('literal'),
    value: variableTypeSchema // It is not really a variable, but the schema is the same as for variable.
  }),
  s.object({
    type: s.literal('variable-reference'),
    value: variableReferenceSchema
  })
]);

// Predicate: a comparison between two operands that evaluates to boolean
const equalsPredicate = s.object({
  type: s.literal('equals'),
  value: s.object({
    left: operandSchema,
    right: operandSchema
  })
});

const notEqualsPredicate = s.object({
  type: s.literal('not-equals'),
  value: s.object({
    left: operandSchema,
    right: operandSchema
  })
});

const greaterThanPredicate = s.object({
  type: s.literal('greater-than'),
  value: s.object({
    left: operandSchema,
    right: operandSchema
  })
});

const greaterThanOrEqualPredicate = s.object({
  type: s.literal('greater-than-or-equal'),
  value: s.object({
    left: operandSchema,
    right: operandSchema
  })
});

const lessThanPredicate = s.object({
  type: s.literal('less-than'),
  value: s.object({
    left: operandSchema,
    right: operandSchema
  })
});

const lessThanOrEqualPredicate = s.object({
  type: s.literal('less-than-or-equal'),
  value: s.object({
    left: operandSchema,
    right: operandSchema
  })
});

// Condition: a rule that evaluates to true/false
// Used to define when states become active (e.g., "selected" state when condition is true)
// Define base condition schema with predicates first
const baseConditionSchema = s.union([
  equalsPredicate,
  notEqualsPredicate,
  greaterThanPredicate,
  greaterThanOrEqualPredicate,
  lessThanPredicate,
  lessThanOrEqualPredicate
]);

// Logical operators: combine conditions (predicates or other logical operations)
// These reference the full condition schema recursively to allow nested conditions
const orCondition = s.object({
  type: s.literal('or'),
  value: s.object({
    left: baseConditionSchema, // For now, using base schema; full recursion requires lazy evaluation
    right: baseConditionSchema
  })
});

const andCondition = s.object({
  type: s.literal('and'),
  value: s.object({
    left: baseConditionSchema, // For now, using base schema; full recursion requires lazy evaluation
    right: baseConditionSchema
  })
});

const notCondition = s.object({
  type: s.literal('not'),
  value: baseConditionSchema // For now, using base schema; full recursion requires lazy evaluation
});

// Full condition schema including logical operators
export const conditionSchema = s.union([
  equalsPredicate,
  notEqualsPredicate,
  greaterThanPredicate,
  greaterThanOrEqualPredicate,
  lessThanPredicate,
  lessThanOrEqualPredicate,
  orCondition,
  andCondition,
  notCondition
]);
