import {
  generateJitteredKeyBetween,
  IndexGenerator
} from 'fractional-indexing-jittered';

/**
 * Position specification for inserting a node.
 */
export interface InsertPosition {
  /** ID of sibling to insert before. null = insert at end */
  beforeSiblingId: string | null;
}

/**
 * Sibling info for index calculation.
 */
export interface SiblingInfo {
  id: string;
  index: string;
}

/**
 * Generate a fractional index for inserting at a position among siblings.
 *
 * @param siblings - Current siblings sorted by index
 * @param beforeSiblingId - ID of sibling to insert before (null = insert at end)
 * @returns A new fractional index string
 */
export function generateIndex(
  siblings: SiblingInfo[],
  beforeSiblingId: string | null
): string {
  const existingIndices = siblings.map((s) => s.index);
  const generator = new IndexGenerator(existingIndices);

  if (siblings.length === 0) {
    // No siblings, generate first index
    return generator.keyEnd();
  }

  if (beforeSiblingId === null) {
    // Place at the end
    return generator.keyEnd();
  }

  const beforeIndex = siblings.findIndex((s) => s.id === beforeSiblingId);

  if (beforeIndex === -1) {
    // Sibling not found, place at end
    return generator.keyEnd();
  }

  if (beforeIndex === 0) {
    // Place at the beginning - generate key before the first sibling
    const firstSibling = siblings[0];
    return generateJitteredKeyBetween(null, firstSibling?.index ?? null);
  }

  // Place between two siblings
  const prevSibling = siblings[beforeIndex - 1];
  const nextSibling = siblings[beforeIndex];

  if (!(prevSibling && nextSibling)) {
    return generator.keyEnd();
  }

  return generateJitteredKeyBetween(prevSibling.index, nextSibling.index);
}

/**
 * Generate a fractional index at the end of a list.
 *
 * @param siblings - Current siblings sorted by index
 * @returns A new fractional index string at the end
 */
export function generateIndexAtEnd(siblings: SiblingInfo[]): string {
  return generateIndex(siblings, null);
}

/**
 * Generate a fractional index at the start of a list.
 *
 * @param siblings - Current siblings sorted by index
 * @returns A new fractional index string at the start
 */
export function generateIndexAtStart(siblings: SiblingInfo[]): string {
  if (siblings.length === 0) {
    const generator = new IndexGenerator([]);
    return generator.keyEnd();
  }
  const firstSibling = siblings[0];
  return generateJitteredKeyBetween(null, firstSibling?.index ?? null);
}
