import type { PaywallComponentJsonEncoding } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";

import type { CliError } from "effect/cli";

import type { ApiClientShape } from "../api-client";
import { componentApiUserError } from "../components/component-api";
import {
  filesHaveConflictMarkers,
  mergeComponentFiles,
  type ComponentMerge,
  type SourceFiles,
} from "./merge";
import {
  isComponentSourcePath,
  sourceFilesHash,
  workingCopyFiles,
  type ComponentState,
  type WorkingCopy,
} from "./working-copy";

/**
 * Brings the working copy up to date with the project's catalog: pulls the
 * components it lacks and merges newer versions of the ones it has
 * (`docs/specs/component-dev-session.md`, "Pulling and merging").
 */

/** The catalog calls a sync makes. */
export type ComponentCatalogApi = Pick<ApiClientShape, "componentsList" | "componentsGetVersion">;

/** A component's newest catalog version, as the listing describes it, with the ids that read it. */
export interface CatalogHead {
  readonly componentId: string;
  readonly versionId: string;
  readonly version: number;
  readonly sourceKind: "wasm" | "rust";
}

/** What a sync does for one component. */
/* oxlint-disable effect/avoid-object-type -- Data.TaggedEnum writes a variant without fields as {}. */
export type ComponentSyncAction = Data.TaggedEnum<{
  /** Write the newest version into a new directory; it becomes the base. */
  Pull: { readonly head: CatalogHead };
  /** Merge the newest version into the existing directory, against the base (or an empty one). */
  Merge: { readonly head: CatalogHead };
  /** The server no longer lists the component: drop its entry, keep its files. */
  BecomeLocal: {};
  /** The newest version is a prebuilt module, without source to edit. */
  NotEditable: {};
  None: {};
}>;
/* oxlint-enable effect/avoid-object-type */
export const ComponentSyncAction = Data.taggedEnum<ComponentSyncAction>();

/**
 * Decides what a sync does for a component, from its newest catalog version
 * (none when the server does not list it), its `state.json` entry and
 * whether the working copy has its directory. `pullMissing` is false for
 * `publish`, which only updates the components the working copy has.
 */
export const componentSyncAction = (input: {
  readonly head: Option.Option<CatalogHead>;
  readonly entry: Option.Option<ComponentState>;
  readonly hasDirectory: boolean;
  readonly pullMissing: boolean;
}): ComponentSyncAction => {
  if (Option.isNone(input.head)) {
    return Option.isSome(input.entry)
      ? ComponentSyncAction.BecomeLocal()
      : ComponentSyncAction.None();
  }
  const head = input.head.value;
  if (head.sourceKind === "wasm") return ComponentSyncAction.NotEditable();
  if (!input.hasDirectory) {
    return input.pullMissing ? ComponentSyncAction.Pull({ head }) : ComponentSyncAction.None();
  }
  if (Option.isNone(input.entry) || head.version > input.entry.value.baseVersion) {
    return ComponentSyncAction.Merge({ head });
  }
  return ComponentSyncAction.None();
};

/** What a sync did, one event per component it touched. */
export type SyncEvent = Data.TaggedEnum<{
  Pulled: { readonly slug: string; readonly version: number };
  Merged: { readonly slug: string; readonly version: number; readonly merge: ComponentMerge };
  BecameLocal: { readonly slug: string };
  NotEditable: { readonly slug: string };
  Skipped: { readonly slug: string; readonly reason: string };
}>;
export const SyncEvent = Data.taggedEnum<SyncEvent>();

/** The files a merge took, merged and left conflicting, as a note: `(updated a.rs; merged b.rs)`. */
const mergeNote = ({ merged, updated }: ComponentMerge) => {
  const parts = [
    ...Arr.match(updated, {
      onEmpty: () => [],
      onNonEmpty: (files) => [`updated ${files.join(", ")}`],
    }),
    ...Arr.match(merged, {
      onEmpty: () => [],
      onNonEmpty: (files) => [`merged ${files.join(", ")}`],
    }),
  ];
  return Arr.match(parts, { onEmpty: () => "", onNonEmpty: (all) => ` (${all.join("; ")})` });
};

/** The line printed for a sync event. */
export const formatSyncEvent = (event: SyncEvent): string =>
  SyncEvent.$match(event, {
    Pulled: ({ slug, version }) => `↓ ${slug}: pulled v${version}.`,
    Merged: ({ merge, slug, version }) =>
      Arr.match(merge.conflicted, {
        onEmpty: () => `↓ ${slug}: merged v${version}${mergeNote(merge)}.`,
        onNonEmpty: (conflicted) =>
          `↓ ${slug}: merged v${version}${mergeNote(merge)}.\n  ! ${conflicted.join(", ")} ${conflicted.length === 1 ? "conflicts" : "conflict"} with your changes: resolve the <<<<<<< local / >>>>>>> v${version} markers.`,
      }),
    BecameLocal: ({ slug }) =>
      `- ${slug}: the project no longer has this component; its files stay as a local component.`,
    NotEditable: ({ slug }) =>
      `- ${slug}: its newest version is a prebuilt module without source, so it is not in the working copy.`,
    Skipped: ({ reason, slug }) => `! ${slug}: ${reason}`,
  });

/** Every component of the project, following the listing's cursors. */
const listProjectComponents = (
  api: ComponentCatalogApi,
  projectId: string,
  cursor: Option.Option<string> = Option.none(),
): Effect.Effect<ReadonlyArray<PaywallComponentJsonEncoding>, CliError.UserError> =>
  api.componentsList(projectId, { cursor: Option.getOrUndefined(cursor), limit: 100 }).pipe(
    Effect.mapError(componentApiUserError),
    Effect.flatMap((page) =>
      Option.match(
        Option.filter(
          Option.fromNullishOr(page.pageInfo.endCursor),
          () => page.pageInfo.hasNextPage,
        ),
        {
          onNone: () => Effect.succeed(page.data),
          onSome: (next) =>
            Effect.map(listProjectComponents(api, projectId, Option.some(next)), (rest) => [
              ...page.data,
              ...rest,
            ]),
        },
      ),
    ),
  );

const decodeSourceFiles = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.String));

/**
 * A component's state after a catalog version was merged into its working
 * copy: the version is the new base, whatever the merge did, and the
 * component is conflicted when the merge left markers, or when markers of
 * an earlier conflict the developer has not resolved yet remain.
 */
export const mergedComponentState = (input: {
  readonly version: number;
  readonly base: SourceFiles;
  readonly baseHash: string;
  readonly merge: ComponentMerge;
  readonly previous: Option.Option<ComponentState>;
}): ComponentState => ({
  baseVersion: input.version,
  baseHash: input.baseHash,
  base: input.base,
  ...Option.match(
    Option.flatMap(input.previous, (state) => Option.fromUndefinedOr(state.publishedVersion)),
    { onNone: () => ({}), onSome: (publishedVersion) => ({ publishedVersion }) },
  ),
  isConflicted:
    Arr.isReadonlyArrayNonEmpty(input.merge.conflicted) ||
    (Option.exists(input.previous, (state) => state.isConflicted) &&
      filesHaveConflictMarkers(input.merge.files)),
});

/**
 * Syncs the working copy with the project's catalog and returns what it did
 * and the title of every component the server lists.
 */
export const syncWorkingCopy = Effect.fn("syncWorkingCopy")(function* (
  workingCopy: WorkingCopy,
  api: ComponentCatalogApi,
  options: { readonly pullMissing: boolean },
) {
  const { projectId } = workingCopy;
  const listed = yield* listProjectComponents(api, projectId);
  const state = yield* workingCopy.readState;
  const local = yield* workingCopy.listComponents;
  const heads = R.fromEntries(
    listed.flatMap((component) =>
      component.latestVersion === null
        ? []
        : [
            [
              component.slug,
              {
                componentId: component.id,
                versionId: component.latestVersion.id,
                version: component.latestVersion.version,
                sourceKind: component.latestVersion.sourceKind,
              } satisfies CatalogHead,
            ] as const,
          ],
    ),
  );
  // A component without a version yet is listed, but has nothing to pull.
  const unversioned = Arr.filter(listed, (component) => !R.has(heads, component.slug)).map(
    (component) => component.slug,
  );
  const slugs = Arr.sort(
    Arr.dedupe([...R.keys(heads), ...R.keys(state.components), ...local]).filter(
      (slug) => !unversioned.includes(slug),
    ),
    Order.String,
  );

  /** Writes a catalog version into the working copy, merged with what it has, and makes it the base. */
  const applyVersion = (slug: string, head: CatalogHead, isPull: boolean) =>
    Effect.gen(function* () {
      const { version } = head;
      const entry = R.get(state.components, slug);
      const detail = yield* api
        .componentsGetVersion(projectId, head.componentId, head.versionId)
        .pipe(Effect.mapError(componentApiUserError));
      const serverFiles = Option.filter(
        decodeSourceFiles(detail.sourceFiles),
        (files) => !R.isEmptyRecord(files),
      );
      if (Option.isNone(serverFiles)) {
        return SyncEvent.Skipped({ slug, reason: `v${version} has no source files to pull.` });
      }
      const unsafe = R.keys(serverFiles.value).filter((file) => !isComponentSourcePath(file));
      if (Arr.isReadonlyArrayNonEmpty(unsafe)) {
        return SyncEvent.Skipped({
          slug,
          reason: `v${version} has files outside Cargo.toml and src/**.rs (${unsafe.join(", ")}), so it was not pulled.`,
        });
      }
      const incoming = workingCopyFiles(slug, serverFiles.value);
      const merge = mergeComponentFiles({
        base: Option.match(entry, { onNone: () => ({}), onSome: (state) => state.base }),
        local: isPull ? {} : yield* workingCopy.readComponentFiles(slug),
        incoming,
        labels: { local: "local", incoming: `v${version}` },
      });
      yield* workingCopy.writeComponentFiles(slug, merge.files);
      const baseHash = yield* sourceFilesHash(incoming);
      yield* workingCopy.updateState((current) => ({
        ...current,
        components: {
          ...current.components,
          [slug]: mergedComponentState({
            version,
            base: incoming,
            baseHash,
            merge,
            previous: R.get(current.components, slug),
          }),
        },
      }));
      return isPull
        ? SyncEvent.Pulled({ slug, version })
        : SyncEvent.Merged({ slug, version, merge });
    });

  const events = yield* Effect.forEach(
    slugs,
    (slug) =>
      ComponentSyncAction.$match(
        componentSyncAction({
          head: R.get(heads, slug),
          entry: R.get(state.components, slug),
          hasDirectory: local.includes(slug),
          pullMissing: options.pullMissing,
        }),
        {
          None: () => Effect.succeed(Option.none<SyncEvent>()),
          NotEditable: () => Effect.succeed(Option.some(SyncEvent.NotEditable({ slug }))),
          BecomeLocal: () =>
            workingCopy
              .updateState((current) => ({
                ...current,
                components: R.remove(current.components, slug),
              }))
              .pipe(Effect.as(Option.some(SyncEvent.BecameLocal({ slug })))),
          Pull: ({ head }) => Effect.map(applyVersion(slug, head, true), Option.some),
          Merge: ({ head }) => Effect.map(applyVersion(slug, head, false), Option.some),
        },
      ),
    { concurrency: 1 },
  );
  return {
    events: Arr.getSomes(events),
    titles: R.fromEntries(listed.map((component) => [component.slug, component.title] as const)),
  };
});
