/** Thrown when a composition file contains a construct outside the closed grammar. */
export class CompositionError extends Error {
  constructor(
    message: string,
    /** 0-based source line (from the TypeScript parser), when known. */
    readonly line?: number,
    /** 0-based source column, when known. */
    readonly column?: number,
  ) {
    super(
      line !== undefined && column !== undefined
        ? `${message} (line ${line + 1}, col ${column + 1})`
        : message,
    );
    this.name = "CompositionError";
  }
}
