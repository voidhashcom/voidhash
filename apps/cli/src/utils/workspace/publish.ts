import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Option from "effect/Option";

import {
  fileChanges,
  filesHaveConflictMarkers,
  formatFileChange,
  type FileChange,
  type SourceFiles,
} from "./merge";
import type { ComponentState } from "./working-copy";

/**
 * What `voidhash-cli publish` offers to publish
 * (`docs/specs/component-dev-session.md`, "Publishing").
 */

/** How a component of the working copy stands against the catalog. */
export type PublishKind = "new" | "modified" | "conflicted" | "unchanged";

/** A component of the working copy and its changes. */
export interface PublishCandidate {
  readonly slug: string;
  readonly kind: PublishKind;
  /** Its files' changes against the base (every file is new for a new component). */
  readonly changes: ReadonlyArray<FileChange>;
}

/**
 * Classifies a component of the working copy: **new** without a base,
 * **conflicted** while the markers of a conflicting merge remain,
 * **modified** when its files differ from the base, and **unchanged**
 * otherwise.
 */
export const publishCandidate = (input: {
  readonly slug: string;
  readonly files: SourceFiles;
  readonly entry: Option.Option<ComponentState>;
}): PublishCandidate => {
  if (Option.isNone(input.entry)) {
    return { slug: input.slug, kind: "new", changes: fileChanges({}, input.files) };
  }
  const entry = input.entry.value;
  const changes = fileChanges(entry.base, input.files);
  const kind: PublishKind =
    entry.isConflicted && filesHaveConflictMarkers(input.files)
      ? "conflicted"
      : Arr.isReadonlyArrayEmpty(changes)
        ? "unchanged"
        : "modified";
  return { slug: input.slug, kind, changes };
};

/** The per-file summary of a candidate: `src/lib.rs +12 −3, src/theme.rs new`. */
export const formatChanges = (candidate: PublishCandidate) =>
  candidate.changes.map(formatFileChange).join(", ");

/** Whether a candidate can be published now. */
export const isSelectable = (candidate: PublishCandidate) =>
  candidate.kind === "new" || candidate.kind === "modified";

/** How the components to publish are chosen. */
export type PublishSelection = Data.TaggedEnum<{
  Selected: { readonly slugs: ReadonlyArray<string> };
  /** Ask in the terminal. */
  // oxlint-disable-next-line effect/avoid-object-type -- Data.TaggedEnum writes a variant without fields as {}.
  Prompt: {};
  Refused: { readonly message: string };
}>;
export const PublishSelection = Data.taggedEnum<PublishSelection>();

/**
 * Chooses the components to publish from the command line: `--all` takes
 * every new and modified component; `--component` names them and refuses
 * unknown, unchanged and conflicted ones; without either, a terminal asks
 * and anything else is refused.
 */
export const selectForPublish = (
  candidates: ReadonlyArray<PublishCandidate>,
  options: {
    readonly all: boolean;
    readonly components: ReadonlyArray<string>;
    readonly isInteractive: boolean;
  },
): PublishSelection => {
  if (options.all) {
    return PublishSelection.Selected({
      slugs: candidates.filter(isSelectable).map((candidate) => candidate.slug),
    });
  }
  if (Arr.isReadonlyArrayNonEmpty(options.components)) {
    const problems = options.components.flatMap((slug) => {
      const candidate = candidates.find((entry) => entry.slug === slug);
      if (candidate === undefined) {
        return [`${slug} is not a component of the working copy (.voidhash/components/${slug}).`];
      }
      if (candidate.kind === "conflicted") {
        return [`${slug} has unresolved conflicts: resolve the conflict markers first.`];
      }
      if (candidate.kind === "unchanged") return [`${slug} has no changes to publish.`];
      return [];
    });
    return Arr.match(problems, {
      onEmpty: () => PublishSelection.Selected({ slugs: Arr.dedupe(options.components) }),
      onNonEmpty: (found) => PublishSelection.Refused({ message: found.join("\n") }),
    });
  }
  if (options.isInteractive) return PublishSelection.Prompt();
  return PublishSelection.Refused({
    message:
      "Choose what to publish with --all or --component <slug>: there is no terminal to ask in.",
  });
};

/**
 * The title `#[component(…)]` gives the component in `src/lib.rs`, for the
 * catalog entry a first publish creates.
 */
export const componentTitleFromSource = (libRs: string): Option.Option<string> =>
  Option.fromNullishOr(/#\[component\([^\]]*?\btitle\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(libRs)?.[1]);

/**
 * A component's state once `publish` created `version` from `files`: the
 * version is the new base, which leaves nothing to resolve.
 * `publishedVersion` moves only once the version's build is ready.
 */
export const publishedComponentState = (input: {
  readonly previous: Option.Option<ComponentState>;
  readonly version: number;
  readonly files: SourceFiles;
  readonly baseHash: string;
}): ComponentState => ({
  ...Option.match(
    Option.flatMap(input.previous, (state) => Option.fromUndefinedOr(state.publishedVersion)),
    { onNone: () => ({}), onSome: (publishedVersion) => ({ publishedVersion }) },
  ),
  baseVersion: input.version,
  baseHash: input.baseHash,
  base: input.files,
  isConflicted: false,
});
