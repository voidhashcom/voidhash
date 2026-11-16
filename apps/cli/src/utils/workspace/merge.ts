/* oxlint-disable effect/imperative-loops -- Myers' difference algorithm and the diff3 walk are index arithmetic over line arrays, which loops state most directly. */
import * as Arr from "effect/Array";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";

/**
 * Line-based diffs and three-way merges of component source files, the way
 * `voidhash-cli dev` folds a newer catalog version into the working copy and
 * `voidhash-cli publish` summarises local changes.
 */

/** The files of a component by crate-relative path (`Cargo.toml`, `src/**.rs`). */
export type SourceFiles = Readonly<Record<string, string>>;

/** A file's lines, each with its line ending, so joining them gives the text back. */
export const splitLines = (text: string): Array<string> =>
  text === "" ? [] : text.split(/(?<=\n)/);

/**
 * The index pairs of the lines a shortest edit script from `a` to `b` keeps,
 * in order: Myers' O(ND) difference algorithm, after the common prefix and
 * suffix are set aside.
 */
export const commonLines = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): Array<readonly [number, number]> => {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  const max = n + m;
  // `v[max + k]` is the furthest x reached on diagonal k; `trace[d]` keeps
  // the diagonals -d..d as they were before step d, for the walk back.
  const v = new Int32Array(2 * max + 2);
  const trace: Array<Int32Array> = [];
  let done = false;
  for (let d = 0; d <= max && !done; d++) {
    trace.push(v.slice(max - d, max + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && (v[max + k - 1] ?? 0) < (v[max + k + 1] ?? 0))
          ? (v[max + k + 1] ?? 0)
          : (v[max + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[start + x] === b[start + y]) {
        x++;
        y++;
      }
      v[max + k] = x;
      if (x >= n && y >= m) {
        done = true;
        break;
      }
    }
  }

  const middle: Array<readonly [number, number]> = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const snapshot = trace[d] ?? new Int32Array(0);
    // `snapshot[i]` holds diagonal `i - d`.
    const at = (k: number) => snapshot[k + d] ?? 0;
    const k = x - y;
    const previousK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const previousX = at(previousK);
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) {
      x--;
      y--;
      middle.push([start + x, start + y]);
    }
    x = previousX;
    y = previousY;
  }
  middle.reverse();
  return [
    // `Arr.makeBy` makes at least one element, so these use `Array.from`.
    ...Array.from({ length: start }, (_, index) => [index, index] as const),
    ...middle,
    ...Array.from({ length: a.length - endA }, (_, index) => [endA + index, endB + index] as const),
  ];
};

/** How many lines `current` adds to `base` and removes from it. */
export const lineChanges = (base: string, current: string) => {
  const before = splitLines(base);
  const after = splitLines(current);
  const kept = commonLines(before, after).length;
  return { added: after.length - kept, removed: before.length - kept };
};

/** Whether a line is a conflict marker a merge writes. */
const isMarkerLine = (line: string) => /^(<{7}|={7}|>{7})(\s|$)/.test(line);

/** Whether `text` still holds a `<<<<<<<`, `=======` or `>>>>>>>` marker line. */
export const hasConflictMarkers = (text: string) => splitLines(text).some(isMarkerLine);

/** Whether any file of a component still holds conflict markers. */
export const filesHaveConflictMarkers = (files: SourceFiles) =>
  R.values(files).some(hasConflictMarkers);

/** Lines ending in a newline, so a marker line can follow them. */
const terminated = (lines: ReadonlyArray<string>) =>
  lines.map((line, index) =>
    index === lines.length - 1 && !line.endsWith("\n") ? `${line}\n` : line,
  );

const sameLines = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((line, index) => line === b[index]);

/** What one side of a three-way merge is called in conflict markers. */
export interface MergeLabels {
  /** `local`. */
  readonly local: string;
  /** `v<version>`. */
  readonly incoming: string;
}

const conflictBlock = (
  local: ReadonlyArray<string>,
  incoming: ReadonlyArray<string>,
  labels: MergeLabels,
) => [
  `<<<<<<< ${labels.local}\n`,
  ...terminated(local),
  "=======\n",
  ...terminated(incoming),
  `>>>>>>> ${labels.incoming}\n`,
];

/**
 * Merges two versions of a text that both derive from `base` (diff3): the
 * lines both keep from the base anchor the merge; between anchors, a side
 * that left the base alone takes the other side's change, identical changes
 * are taken once, and different changes become a conflict block.
 */
export const mergeText = (
  base: string,
  local: string,
  incoming: string,
  labels: MergeLabels,
): { readonly text: string; readonly hasConflicts: boolean } => {
  const baseLines = splitLines(base);
  const localLines = splitLines(local);
  const incomingLines = splitLines(incoming);
  const inLocal = new Int32Array(baseLines.length).fill(-1);
  const inIncoming = new Int32Array(baseLines.length).fill(-1);
  for (const [b, l] of commonLines(baseLines, localLines)) inLocal[b] = l;
  for (const [b, r] of commonLines(baseLines, incomingLines)) inIncoming[b] = r;

  const output: Array<string> = [];
  let hasConflicts = false;
  let b = 0;
  let l = 0;
  let r = 0;
  for (;;) {
    // The next base line both sides kept ends the chunk that differs.
    let anchor = b;
    while (
      anchor < baseLines.length &&
      ((inLocal[anchor] ?? -1) < 0 || (inIncoming[anchor] ?? -1) < 0)
    ) {
      anchor++;
    }
    const localEnd = anchor < baseLines.length ? (inLocal[anchor] ?? 0) : localLines.length;
    const incomingEnd =
      anchor < baseLines.length ? (inIncoming[anchor] ?? 0) : incomingLines.length;
    const baseChunk = baseLines.slice(b, anchor);
    const localChunk = localLines.slice(l, localEnd);
    const incomingChunk = incomingLines.slice(r, incomingEnd);
    if (sameLines(localChunk, baseChunk)) {
      output.push(...incomingChunk);
    } else if (sameLines(incomingChunk, baseChunk) || sameLines(localChunk, incomingChunk)) {
      output.push(...localChunk);
    } else {
      hasConflicts = true;
      output.push(...conflictBlock(localChunk, incomingChunk, labels));
    }
    if (anchor >= baseLines.length) break;
    output.push(baseLines[anchor] ?? "");
    b = anchor + 1;
    l = localEnd + 1;
    r = incomingEnd + 1;
  }
  return { text: output.join(""), hasConflicts };
};

/** The outcome of merging a newer version into a component's working copy. */
export interface ComponentMerge {
  /** The working copy's files after the merge. */
  readonly files: SourceFiles;
  /** Files only the new version changed, which the working copy now takes. */
  readonly updated: ReadonlyArray<string>;
  /** Files both sides changed whose changes merged line by line. */
  readonly merged: ReadonlyArray<string>;
  /** Files that now hold conflict markers. */
  readonly conflicted: ReadonlyArray<string>;
}

/**
 * Merges `incoming` (a newer catalog version) into `local` (the working
 * copy), three ways against `base`, file by file: a file changed on one side
 * only takes that side, a deletion included; a file changed on both merges
 * line by line ({@link mergeText}); a file deleted on one side and changed on
 * the other becomes a conflict block against an empty side. An empty `base`
 * adopts identical files and conflicts on every other file both sides have.
 */
export const mergeComponentFiles = (input: {
  readonly base: SourceFiles;
  readonly local: SourceFiles;
  readonly incoming: SourceFiles;
  readonly labels: MergeLabels;
}): ComponentMerge => {
  const paths = Arr.sort(
    Arr.dedupe([...R.keys(input.base), ...R.keys(input.local), ...R.keys(input.incoming)]),
    Order.String,
  );
  const files: Record<string, string> = {};
  const updated: Array<string> = [];
  const merged: Array<string> = [];
  const conflicted: Array<string> = [];
  for (const path of paths) {
    const base = R.get(input.base, path);
    const local = R.get(input.local, path);
    const incoming = R.get(input.incoming, path);
    const same = (a: Option.Option<string>, b: Option.Option<string>) =>
      Option.isNone(a) ? Option.isNone(b) : Option.isSome(b) && a.value === b.value;
    const keep = (content: Option.Option<string>) => {
      if (Option.isSome(content)) files[path] = content.value;
    };
    if (same(local, incoming) || same(incoming, base)) {
      keep(local);
    } else if (same(local, base)) {
      keep(incoming);
      updated.push(path);
    } else {
      const result = mergeText(
        Option.getOrElse(base, () => ""),
        Option.getOrElse(local, () => ""),
        Option.getOrElse(incoming, () => ""),
        input.labels,
      );
      // A deletion against a change conflicts even where the text would
      // merge: deleting the file is not a line change diff3 can apply.
      const deletedOnOneSide = Option.isNone(local) || Option.isNone(incoming);
      if (deletedOnOneSide && !result.hasConflicts) {
        files[path] = conflictBlock(
          splitLines(Option.getOrElse(local, () => "")),
          splitLines(Option.getOrElse(incoming, () => "")),
          input.labels,
        ).join("");
        conflicted.push(path);
      } else {
        files[path] = result.text;
        (result.hasConflicts ? conflicted : merged).push(path);
      }
    }
  }
  return { files, updated, merged, conflicted };
};

/** Whether two sets of files have the same paths with the same contents. */
export const sameSourceFiles = (a: SourceFiles, b: SourceFiles) =>
  R.keys(a).length === R.keys(b).length &&
  R.toEntries(a).every(([path, content]) => b[path] === content);

/** How a file of a component differs from its base. */
export type FileChange =
  | { readonly path: string; readonly kind: "new" }
  | { readonly path: string; readonly kind: "deleted" }
  | {
      readonly path: string;
      readonly kind: "modified";
      readonly added: number;
      readonly removed: number;
    };

/** The files that differ between `base` and `current`, in path order. */
export const fileChanges = (base: SourceFiles, current: SourceFiles): Array<FileChange> =>
  Arr.sort(Arr.dedupe([...R.keys(base), ...R.keys(current)]), Order.String).flatMap(
    (path): Array<FileChange> => {
      const before = R.get(base, path);
      const after = R.get(current, path);
      if (Option.isNone(before)) return [{ path, kind: "new" }];
      if (Option.isNone(after)) return [{ path, kind: "deleted" }];
      if (before.value === after.value) return [];
      return [{ path, kind: "modified", ...lineChanges(before.value, after.value) }];
    },
  );

/** `src/lib.rs +12 −3`, `src/theme.rs new`, `src/old.rs deleted`. */
export const formatFileChange = (change: FileChange): string =>
  Match.value(change).pipe(
    Match.discriminatorsExhaustive("kind")({
      new: ({ path }) => `${path} new`,
      deleted: ({ path }) => `${path} deleted`,
      modified: ({ added, path, removed }) => `${path} +${added} −${removed}`,
    }),
  );
