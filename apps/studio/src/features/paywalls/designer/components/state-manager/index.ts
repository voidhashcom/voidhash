/**
 * StateManager module - manages paywall states and their DNF conditions.
 *
 * Only the main StateManagerSheet component is publicly exported.
 * All sub-components, hooks, and utilities are internal implementation details.
 */
export { StateManagerSheet } from './state-manager-sheet';
export type { StateManagerSheetProps, CRDTState, CRDTVariable } from './types';
