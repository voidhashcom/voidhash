/**
 * How the paywall and location commands name and describe what end users
 * see: the paywalls and locations people name on the command line, builds,
 * what a location shows, and waiting for a build to finish.
 */
import type {
  ExperimentJsonEncoding,
  PaywallBuildJsonEncoding,
  PaywallJsonEncoding,
  PaywallLocationJsonEncoding,
  PaywallLocationShowingJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { ApiClient, readAll } from "../../utils/api-client";
import { type ItemKind, requireItem } from "../input";

export const paywallKind: ItemKind<PaywallJsonEncoding> = {
  noun: "paywall",
  label: (paywall) => `${paywall.name} (${paywall.slug})`,
  listCommand: "voidhash-cli paywall list",
  createCommand: "voidhash-cli paywall create",
  keys: (paywall) => [paywall.slug],
  names: (paywall) => [paywall.name],
};

export const locationKind: ItemKind<PaywallLocationJsonEncoding> = {
  noun: "location",
  label: (location) => `${location.name} (${location.slug})`,
  listCommand: "voidhash-cli location list",
  createCommand: "voidhash-cli location create",
  keys: (location) => [location.slug],
  names: (location) => [location.name],
};

/** The paywall kinds as `--kind` takes them. */
export const PAYWALL_KINDS = [
  ["paywall", "paywall"],
  ["onboarding", "onboarding"],
] as const;

export const kindLabel = (paywall: PaywallJsonEncoding) =>
  paywall.kind === "onboarding" ? "Onboarding flow" : "Paywall";

export const buildLabel = (build: Pick<PaywallBuildJsonEncoding, "number">) =>
  `build #${build.number}`;

/** Every paywall of the project, archived or not. */
export const listPaywalls = (projectId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    return yield* readAll((query) => api.paywallsList(projectId, query));
  });

/** Every location of the project, archived or not. */
export const listLocations = (projectId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    return yield* readAll((query) => api.paywallLocationsList(projectId, query));
  });

/** The paywall's builds, newest first: the API keeps its 50 most recent. */
export const listBuilds = (projectId: string, paywallId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    return (yield* api.paywallsListBuilds(projectId, paywallId, { limit: 50 })).data;
  });

/** The project's experiments in use, for naming what a location runs; empty when they cannot be read. */
export const listExperiments = (projectId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    return yield* readAll((query) => api.experimentsList(projectId, query));
  }).pipe(
    // Only names what a location runs, so a key without experiments still lists locations.
    Effect.orElseSucceed((): ReadonlyArray<ExperimentJsonEncoding> => []),
  );

/** The unarchived locations showing `paywall` directly. */
export const locationsShowing = (
  locations: ReadonlyArray<PaywallLocationJsonEncoding>,
  paywall: PaywallJsonEncoding,
) =>
  locations.filter(
    (location) =>
      !location.isArchived &&
      location.showing?.type === "paywall" &&
      location.showing.paywallId === paywall.id,
  );

/**
 * What a showing serves, as people say it: "Pro (pro), build #3", or the
 * experiment whose flag decides it.
 */
export const describeShowing = (
  showing: PaywallLocationShowingJsonEncoding,
  paywalls: ReadonlyArray<PaywallJsonEncoding>,
  experiments: ReadonlyArray<ExperimentJsonEncoding>,
) => {
  if (showing.type === "paywall") {
    const paywall = paywalls.find(({ id }) => id === showing.paywallId);
    const name =
      paywall === undefined ? (showing.paywallId ?? "a paywall") : paywallKind.label(paywall);
    return `${name}${showing.buildNumber === null ? "" : `, build #${showing.buildNumber}`}`;
  }
  const experiment = experiments.find(
    ({ featureFlagId }) => featureFlagId === showing.featureFlagId,
  );
  return experiment === undefined
    ? `an experiment (flag ${showing.featureFlagId ?? "unknown"})`
    : `experiment ${experiment.name} (${experiment.status})`;
};

/** Why a build failed, one problem per line. */
export const describeFailure = (build: PaywallBuildJsonEncoding) =>
  [
    build.failure?.message ?? "It failed without a reason.",
    ...(build.failure?.diagnostics ?? []).map(
      (diagnostic) =>
        `  - ${diagnostic.message} (${diagnostic.code}${diagnostic.nodeId === null || diagnostic.nodeId === undefined ? "" : `, node ${diagnostic.nodeId}`})`,
    ),
  ].join("\n");

/** A build's status as a table cell: "ready, live", "failed", "building". */
export const buildStatus = (build: PaywallBuildJsonEncoding) =>
  build.status === "ready" && build.isDeployed ? "ready, live" : build.status;

/**
 * The build once it is no longer building, or as it is after `timeout`.
 * Reads it every two seconds.
 */
export const waitForBuild = (
  projectId: string,
  build: PaywallBuildJsonEncoding,
  timeout: Duration.Duration,
) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const deadline = (yield* Clock.currentTimeMillis) + Duration.toMillis(timeout);
    const poll = (
      current: PaywallBuildJsonEncoding,
    ): Effect.Effect<PaywallBuildJsonEncoding, ApiClientFailure> =>
      current.status !== "building"
        ? Effect.succeed(current)
        : Effect.gen(function* () {
            const remaining = deadline - (yield* Clock.currentTimeMillis);
            if (remaining <= 0) return current;
            yield* Effect.sleep(Duration.millis(Math.min(2000, remaining)));
            return yield* poll(yield* api.paywallsGetBuild(projectId, build.paywallId, build.id));
          });
    return yield* poll(build);
  });

/** What reading a build can fail with. */
type ApiClientFailure = Effect.Error<ReturnType<ApiClient["Service"]["paywallsGetBuild"]>>;

/** The build `input` names among `builds`: its id, or its number with or without `#`. */
export const findBuild = (builds: ReadonlyArray<PaywallBuildJsonEncoding>, input: string) => {
  const wanted = input.trim().replace(/^#/, "");
  return Arr.findFirst(builds, (build) => build.id === wanted || String(build.number) === wanted);
};

/** The deployed build among `builds`. */
export const deployedBuild = (builds: ReadonlyArray<PaywallBuildJsonEncoding>) =>
  Arr.findFirst(builds, (build) => build.isDeployed);

/** "Home (home), Upgrade (upgrade)", or `none`. */
export const locationNames = (locations: ReadonlyArray<PaywallLocationJsonEncoding>, none = "-") =>
  Arr.match(locations, {
    onEmpty: () => none,
    onNonEmpty: (some) => some.map(locationKind.label).join(", "),
  });

/** The dashboard page of the paywall `item` names, for `voidhash-cli open paywall <paywall>`. */
export const paywallPagePath = (projectId: string, item: Option.Option<string>) =>
  Effect.gen(function* () {
    const paywall = yield* requireItem(
      paywallKind,
      yield* listPaywalls(projectId),
      item,
      "voidhash-cli open paywall <paywall>",
    );
    return `paywalls/${paywall.id}`;
  });

/** The dashboard page of the location `item` names, for `voidhash-cli open location <location>`. */
export const locationPagePath = (projectId: string, item: Option.Option<string>) =>
  Effect.gen(function* () {
    const location = yield* requireItem(
      locationKind,
      yield* listLocations(projectId),
      item,
      "voidhash-cli open location <location>",
    );
    return `settings/paywall-locations/${location.id}`;
  });
