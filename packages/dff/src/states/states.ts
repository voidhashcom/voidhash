// import { z } from 'zod';
// import { variableTypeSchema } from '../variables';
// import { variableReferenceSchema } from '../variables/variables';

// // Operand: a value that can be compared (literal or variable reference)
// const operandSchema = z.union([
//   z.object({
//     type: z.literal('literal'),
//     value: variableTypeSchema // It is not really a variable, but the schema is the same as for variable.
//   }),
//   z.object({
//     type: z.literal('variable-reference'),
//     value: variableReferenceSchema
//   })
// ]);

// // Predicate: a comparison between two operands that evaluates to boolean
// const equalsPredicate = z.object({
//   type: z.literal('equals'),
//   value: z.object({
//     left: operandSchema,
//     right: operandSchema
//   })
// });

// const notEqualsPredicate = z.object({
//   type: z.literal('not-equals'),
//   value: z.object({
//     left: operandSchema,
//     right: operandSchema
//   })
// });

// const greaterThanPredicate = z.object({
//   type: z.literal('greater-than'),
//   value: z.object({
//     left: operandSchema,
//     right: operandSchema
//   })
// });

// const greaterThanOrEqualPredicate = z.object({
//   type: z.literal('greater-than-or-equal'),
//   value: z.object({
//     left: operandSchema,
//     right: operandSchema
//   })
// });

// const lessThanPredicate = z.object({
//   type: z.literal('less-than'),
//   value: z.object({
//     left: operandSchema,
//     right: operandSchema
//   })
// });

// const lessThanOrEqualPredicate = z.object({
//   type: z.literal('less-than-or-equal'),
//   value: z.object({
//     left: operandSchema,
//     right: operandSchema
//   })
// });

// // Literal: a predicate (atomic unit in DNF)
// // In DNF, literals are the basic building blocks
// // All negations can be expressed using the existing comparison operators:
// // - not(equals) → not-equals
// // - not(greater-than) → less-than-or-equal
// // - not(less-than) → greater-than-or-equal
// // - etc.
// const literalSchema = z.union([
//   equalsPredicate,
//   notEqualsPredicate,
//   greaterThanPredicate,
//   greaterThanOrEqualPredicate,
//   lessThanPredicate,
//   lessThanOrEqualPredicate
// ]);

// // Conjunction (AND clause): AND of literals
// // In DNF, each clause is a conjunction of literals
// const conjunctionSchema = z.object({
//   type: z.literal('and'),
//   value: z.array(literalSchema).min(1) // Array of literals: [literal1, literal2, literal3]
// });

// // DNF (Disjunctive Normal Form): OR of conjunctions
// // Root structure: OR of multiple AND clauses
// // Each AND clause contains literals (predicates)
// export const dnfSchema = z.object({
//   type: z.literal('or'),
//   value: z.array(conjunctionSchema).min(1) // Array of conjunctions: [conjunction1, conjunction2, ...]
// });

// // Condition schema: exported for general use (allows any condition structure)
// export const conditionSchema: z.ZodTypeAny = z.lazy(() =>
//   z.union([literalSchema, conjunctionSchema, dnfSchema])
// );

// // State schema: condition must be in DNF format
// // DNF = OR of AND clauses, where each clause contains literals
// export const stateSchema = z.object({
//   id: z.string(),
//   name: z.string(),
//   condition: dnfSchema
// });
