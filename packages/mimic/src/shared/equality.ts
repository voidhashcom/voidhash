export const arraysEqual = <T>(
  left: readonly T[],
  right: readonly T[],
  predicate: (a: T, b: T) => boolean = Object.is,
): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (!predicate(left[index]!, right[index]!)) {
      return false;
    }
  }
  return true;
};
