// import type { Handle } from './types';

// /**
//  * Path segment in the document tree.
//  * Used to track the location of a handle for updates.
//  */
// export type PathSegment = string | number;

// /**
//  * Internal handle implementation with path tracking.
//  */
// export interface InternalHandle<T> extends Handle<T> {
//   /** Internal path to the value */
//   readonly _path: readonly PathSegment[];

//   /** Get nested property handle */
//   readonly [K: string]: unknown;
// }

// /**
//  * Create a handle for a value at a given path.
//  * The handle provides get/set/update operations and property accessors.
//  */
// export function createHandle<T>(
//   getValue: () => T,
//   setValue: (value: T) => void,
//   path: readonly PathSegment[] = []
// ): Handle<T> {
//   const handle: InternalHandle<T> = {
//     _path: path,

//     get(): T {
//       return getValue();
//     },

//     set(value: T): void {
//       setValue(value);
//     },

//     update(partial: Partial<T>): void {
//       if (typeof partial !== 'object' || partial === null) {
//         throw new Error('update() can only be called on object handles');
//       }

//       const current = getValue();
//       if (typeof current !== 'object' || current === null) {
//         throw new Error('update() can only be called on object handles');
//       }

//       setValue({ ...current, ...partial } as T);
//     }
//   };

//   // Add property accessors for nested access
//   // This is a proxy that intercepts property access
//   return new Proxy(handle, {
//     get(target, prop: string | symbol) {
//       // Return internal properties
//       if (
//         prop === '_path' ||
//         prop === 'get' ||
//         prop === 'set' ||
//         prop === 'update'
//       ) {
//         return target[prop as keyof typeof target];
//       }

//       // For string properties, create nested handles
//       if (typeof prop === 'string') {
//         return createNestedHandle(
//           () => {
//             const value = getValue();
//             if (typeof value !== 'object' || value === null) {
//               throw new Error(`Cannot access property '${prop}' on non-object`);
//             }
//             return (value as Record<string, unknown>)[prop];
//           },
//           (newValue: unknown) => {
//             const current = getValue();
//             if (typeof current !== 'object' || current === null) {
//               throw new Error(`Cannot set property '${prop}' on non-object`);
//             }
//             setValue({ ...current, [prop]: newValue } as T);
//           },
//           [...path, prop]
//         );
//       }

//       return;
//     }
//   }) as Handle<T>;
// }

// /**
//  * Create a nested handle for a property.
//  */
// function createNestedHandle<T>(
//   getValue: () => unknown,
//   setValue: (value: unknown) => void,
//   path: readonly PathSegment[]
// ): Handle<T> {
//   return createHandle(
//     () => getValue() as T,
//     (value: T) => setValue(value),
//     path
//   );
// }
