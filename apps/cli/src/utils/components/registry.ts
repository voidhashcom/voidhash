import type {
  PublishedComponentChangeKind,
  PublishedComponentInstallJsonEncoding,
  PublishedComponentInstallReviewJsonEncoding,
  PublishedComponentJsonEncoding,
  PublishedComponentVersionJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type { ApiClientShape } from "../api-client";
import { userError } from "../error-formatter";
import { componentApiUserError, WARNING_LABELS } from "./component-api";

/**
 * What each kind of definition change means for a project, in one line. A
 * change a newer server reports that this CLI does not know is printed as
 * its kind.
 */
const CHANGE_LABELS: Readonly<Record<string, string>> = {
  capability_added: "asks for",
  capability_removed: "no longer asks for",
  prop_added: "adds prop",
  prop_removed: "removes prop",
  prop_type_changed: "changes the type of prop",
  event_added: "adds event",
  event_removed: "removes event",
  event_payload_changed: "changes the payload of event",
} satisfies Record<PublishedComponentChangeKind, string>;

/** The lines a person reads before installing or updating the registry component `slug`. */
export const formatInstallReview = (
  slug: string,
  review: PublishedComponentInstallReviewJsonEncoding,
): string => {
  const from = review.currentVersion === null ? "" : `${review.currentVersion} → `;
  return [
    `${slug} ${from}${review.targetVersion} (range ${review.versionRange})`,
    ...Arr.match(review.targetCapabilities, {
      onEmpty: () => [],
      onNonEmpty: (capabilities) => [`  Capabilities: ${capabilities.join(", ")}`],
    }),
    ...Arr.map(
      review.changes,
      (change) => `  - ${CHANGE_LABELS[change.kind] ?? change.kind} ${change.name}`,
    ),
  ].join("\n");
};

/**
 * The consent that accepts a review: its version and every capability that
 * version asks for. Only built when the person passed `--yes`.
 */
export const consentForReview = (review: PublishedComponentInstallReviewJsonEncoding) => ({
  version: review.targetVersion,
  capabilities: [...review.targetCapabilities],
});

/**
 * Prints the facts of version `version` of the registry component `slug`, one
 * aligned line each, then its warnings.
 */
export const formatRegistryVersion = (
  slug: string,
  version: PublishedComponentVersionJsonEncoding,
): string =>
  [
    `${slug} ${version.version}`,
    `  Status:       ${version.status}${version.statusMessage ? ` (${version.statusMessage})` : ""}`,
    `  Number:       ${version.number}`,
    `  Capabilities: ${version.capabilities.join(", ") || "none"}`,
    `  Content hash: ${version.contentHash}`,
    `  Bundle hash:  ${version.bundleHash}`,
    `  Size:         ${version.byteSize} bytes`,
    ...Arr.map(version.warnings, (warning) => `  ! ${WARNING_LABELS[warning] ?? warning}`),
  ].join("\n");

/** One line per install for `registry install`/`update`. */
export const formatInstall = (install: PublishedComponentInstallJsonEncoding): string =>
  `${install.slug} ${install.version} (range ${install.versionRange})`;

/**
 * Parses `--from-project <slug>@<version>`: a project component slug and its
 * catalog version number.
 */
export const parseProjectVersion = (
  value: string,
): Option.Option<{ readonly slug: string; readonly version: number }> => {
  const match = /^([a-z0-9][a-z0-9-]*)@([1-9]\d*)$/.exec(value.trim());
  if (match === null) return Option.none();
  return Option.some({ slug: match[1] ?? "", version: Number(match[2]) });
};

/** Splits a registry component id (`acme/wheel-picker`) into its publisher and name. */
export const parseComponentId = (
  componentId: string,
): Option.Option<{ readonly publisher: string; readonly name: string }> => {
  const match = /^([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/.exec(componentId.trim());
  if (match === null) return Option.none();
  return Option.some({ publisher: match[1] ?? "", name: match[2] ?? "" });
};

/** The id's publisher and name, or a user-facing error for a malformed id. */
export const requireComponentId = (componentId: string) =>
  Option.match(parseComponentId(componentId), {
    onNone: () =>
      Effect.fail(userError(`"${componentId}" is not a component id such as acme/wheel-picker.`)),
    onSome: Effect.succeed,
  });

/**
 * The component of the organization's registry that `slug` (`acme/wheel-picker`)
 * names, as the project sees it, with the project's install of it. Fails for a
 * malformed slug, and when the registry has no such component.
 */
export const findRegistryComponent = Effect.fn("findRegistryComponent")(function* (
  api: Pick<ApiClientShape, "componentRegistryList">,
  projectId: string,
  slug: string,
) {
  const { name, publisher } = yield* requireComponentId(slug);
  const page = yield* api
    .componentRegistryList(projectId, { slug: `${publisher}/${name}` })
    .pipe(Effect.mapError(componentApiUserError));
  return yield* Effect.fromOption(Arr.head(page.data), () =>
    userError(
      `Your organization's registry has no component ${slug}. 'voidhash-cli registry list' shows them.`,
    ),
  );
});

/** The version of the registry `component` published as the semantic version `version`. */
export const findRegistryVersion = Effect.fn("findRegistryVersion")(function* (
  api: Pick<ApiClientShape, "componentRegistryListVersions">,
  projectId: string,
  component: PublishedComponentJsonEncoding,
  version: string,
) {
  const page = yield* api
    .componentRegistryListVersions(projectId, component.id, { version })
    .pipe(Effect.mapError(componentApiUserError));
  return yield* Effect.fromOption(Arr.head(page.data), () =>
    userError(`${component.slug} has no version ${version}.`),
  );
});
