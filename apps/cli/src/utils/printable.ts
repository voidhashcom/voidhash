/**
 * `text` from the server without control characters, or the characters that
 * reorder text, so it cannot move the cursor, change what the terminal shows
 * or hand the terminal commands. Names, emails and distinct ids come from the
 * end users of an app, so anything the CLI shows people passes through this.
 */
export const printable = (text: string) => text.replace(/[\p{Cc}‪-‮⁦-⁩]/gu, "");

/** {@link printable} text that keeps its line breaks, for a message of several lines. */
export const printableLines = (text: string) => text.split("\n").map(printable).join("\n");
