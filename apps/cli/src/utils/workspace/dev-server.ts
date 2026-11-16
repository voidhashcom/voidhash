import { PanelManifestEntry } from "@voidhash/component-build";
import { ComponentDefinition } from "@voidhash/component-definition";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import type { CrateBuild, CrateBuildError } from "../components/crate-build";
import { filesHaveConflictMarkers, sameSourceFiles, type SourceFiles } from "./merge";
import { sha256Hex, type ComponentState } from "./working-copy";

/**
 * The local server of `voidhash-cli dev`: the build state of every component
 * of the working copy and the HTTP routes the paywall editor reads them
 * through. The protocol is specified in `docs/specs/component-dev-session.md`.
 */

/** The protocol version the server speaks. */
export const DEV_PROTOCOL = 2;

/** The port `dev` listens on by default. */
export const DEV_SERVER_DEFAULT_PORT = 4319;

/** How many successful builds of a component stay downloadable. */
const KEPT_BUILDS = 4;
const MAX_LOG_CHARS = 64 * 1024;

const DevArtifact = Schema.Struct({
  hash: Schema.String,
  byteSize: Schema.Number,
  url: Schema.String,
});

/** One component as `GET /v1/status` describes it. */
export const DevComponentStatus = Schema.Struct({
  slug: Schema.String,
  definitionId: Schema.String,
  title: Schema.String,
  origin: Schema.Literals(["server", "local"]),
  baseVersion: Schema.optionalKey(Schema.Number),
  publishedVersion: Schema.optionalKey(Schema.Number),
  isModified: Schema.Boolean,
  isConflicted: Schema.Boolean,
  build: Schema.Struct({
    /** `0` until the first build starts. */
    number: Schema.Number,
    state: Schema.Literals(["building", "ready", "failed"]),
    startedAt: Schema.String,
    finishedAt: Schema.NullOr(Schema.String),
    message: Schema.NullOr(Schema.String),
    log: Schema.String,
  }),
  /** The last successful build. */
  component: Schema.NullOr(
    Schema.Struct({
      build: Schema.Number,
      builtAt: Schema.String,
      definition: ComponentDefinition,
      module: DevArtifact,
      panel: Schema.NullOr(
        Schema.Struct({ ...DevArtifact.fields, panels: Schema.Array(PanelManifestEntry) }),
      ),
    }),
  ),
});
export type DevComponentStatus = typeof DevComponentStatus.Type;

/** What `GET /v1/status` answers. */
export const DevStatus = Schema.Struct({
  protocol: Schema.Literal(DEV_PROTOCOL),
  components: Schema.Array(DevComponentStatus),
});
export type DevStatus = typeof DevStatus.Type;

const encodeStatus = Schema.encodeSync(Schema.fromJsonString(DevStatus));

/**
 * What the working copy says of a component: its title until a build names
 * one, where it comes from, and how it relates to its base.
 */
export type WorkingCopyFacts = Pick<
  DevComponentStatus,
  "title" | "origin" | "baseVersion" | "publishedVersion" | "isModified" | "isConflicted"
>;

/**
 * What the working copy says of a component, from its files and its
 * `state.json` entry: a component without an entry is local and always
 * modified; markers keep a conflicted component conflicted.
 */
export const workingCopyFacts = (input: {
  readonly files: SourceFiles;
  readonly entry: Option.Option<ComponentState>;
  readonly title: string;
}): WorkingCopyFacts =>
  Option.match(input.entry, {
    onNone: () => ({
      title: input.title,
      origin: "local",
      isModified: true,
      isConflicted: false,
    }),
    onSome: (entry) => ({
      title: input.title,
      origin: "server",
      baseVersion: entry.baseVersion,
      ...(entry.publishedVersion === undefined ? {} : { publishedVersion: entry.publishedVersion }),
      isModified: !sameSourceFiles(entry.base, input.files),
      isConflicted: entry.isConflicted && filesHaveConflictMarkers(input.files),
    }),
  });

interface BuiltModules {
  readonly module: { readonly hash: string; readonly bytes: Uint8Array };
  readonly panel: Option.Option<{ readonly hash: string; readonly bytes: Uint8Array }>;
}

const keepLogEnd = (log: string) =>
  log.length <= MAX_LOG_CHARS ? log : `[log truncated]\n${log.slice(log.length - MAX_LOG_CHARS)}`;

/** The build state the dev server serves, one entry per component of the working copy. */
export interface DevServerState {
  readonly components: SubscriptionRef.SubscriptionRef<
    Readonly<Record<string, DevComponentStatus>>
  >;
  /** The modules of each component's last successful builds, newest first. */
  readonly modules: Ref.Ref<Readonly<Record<string, ReadonlyArray<BuiltModules>>>>;
  /** Adds a component, or updates what the working copy says of it. */
  readonly describe: (slug: string, facts: WorkingCopyFacts) => Effect.Effect<void>;
  /**
   * Runs `build` as the component's next build and records its outcome.
   * Returns the component's status after it, or none when the component
   * was removed meanwhile.
   */
  readonly rebuild: <R>(
    slug: string,
    build: Effect.Effect<CrateBuild, CrateBuildError, R>,
  ) => Effect.Effect<Option.Option<DevComponentStatus>, never, R>;
  /** Stops serving a component. */
  readonly remove: (slug: string) => Effect.Effect<void>;
  /** The status, components in slug order. */
  readonly status: Effect.Effect<DevStatus>;
}

export const makeDevServerState = Effect.fn("makeDevServerState")(function* () {
  const now = Effect.map(DateTime.now, DateTime.formatIso);
  const components = yield* SubscriptionRef.make<Readonly<Record<string, DevComponentStatus>>>({});
  const modules = yield* Ref.make<Readonly<Record<string, ReadonlyArray<BuiltModules>>>>({});

  /** Applies `change` to the component's status when it is still served. */
  const change = (slug: string, update: (status: DevComponentStatus) => DevComponentStatus) =>
    SubscriptionRef.update(components, (current) =>
      Option.match(R.get(current, slug), {
        onNone: () => current,
        onSome: (status) => ({ ...current, [slug]: update(status) }),
      }),
    );

  const describe = (slug: string, facts: WorkingCopyFacts) =>
    Effect.gen(function* () {
      const startedAt = yield* now;
      yield* SubscriptionRef.update(components, (current) => {
        const existing = R.get(current, slug);
        const component = Option.match(existing, {
          onNone: () => null,
          onSome: (status) => status.component,
        });
        const next: DevComponentStatus = {
          slug,
          definitionId: `project/${slug}`,
          ...facts,
          title: component === null ? facts.title : component.definition.title,
          build: Option.match(existing, {
            onNone: () => ({
              number: 0,
              state: "building" as const,
              startedAt,
              finishedAt: null,
              message: null,
              log: "",
            }),
            onSome: (status) => status.build,
          }),
          component,
        };
        return { ...current, [slug]: next };
      });
    });

  const rebuild = <R>(slug: string, build: Effect.Effect<CrateBuild, CrateBuildError, R>) =>
    Effect.gen(function* () {
      const startedAt = yield* now;
      const number = yield* SubscriptionRef.modify(components, (current) =>
        Option.match(R.get(current, slug), {
          onNone: () => [0, current] as const,
          onSome: (status) => {
            const next = status.build.number + 1;
            return [
              next,
              {
                ...current,
                [slug]: {
                  ...status,
                  build: {
                    number: next,
                    state: "building",
                    startedAt,
                    finishedAt: null,
                    message: null,
                    log: "",
                  },
                },
              },
            ] as const;
          },
        }),
      );
      const outcome = yield* Effect.result(build);
      const finishedAt = yield* now;
      if (Result.isFailure(outcome)) {
        yield* change(slug, (status) => ({
          ...status,
          build: {
            number,
            state: "failed",
            startedAt,
            finishedAt,
            message: outcome.failure.message,
            log: keepLogEnd(outcome.failure.log),
          },
        }));
      } else {
        const built = outcome.success;
        const module = { hash: yield* sha256Hex(built.module), bytes: built.module };
        const panel = yield* Effect.transposeOption(
          Option.map(built.panel, (bytes) =>
            Effect.map(sha256Hex(bytes), (hash) => ({ hash, bytes })),
          ),
        );
        yield* Ref.update(modules, (current) => ({
          ...current,
          [slug]: [{ module, panel }, ...(current[slug] ?? [])].slice(0, KEPT_BUILDS),
        }));
        yield* change(slug, (status) => ({
          ...status,
          title: built.definition.title,
          build: {
            number,
            state: "ready",
            startedAt,
            finishedAt,
            message: null,
            log: keepLogEnd(built.log),
          },
          component: {
            build: number,
            builtAt: finishedAt,
            definition: built.definition,
            module: {
              hash: module.hash,
              byteSize: module.bytes.byteLength,
              url: `/v1/modules/${module.hash}`,
            },
            panel: Option.getOrNull(
              Option.map(panel, ({ hash, bytes }) => ({
                hash,
                byteSize: bytes.byteLength,
                url: `/v1/panels/${hash}`,
                panels: built.panels,
              })),
            ),
          },
        }));
      }
      return R.get(yield* SubscriptionRef.get(components), slug);
    });

  const remove = (slug: string) =>
    Effect.andThen(
      SubscriptionRef.update(components, (current) => R.remove(current, slug)),
      Ref.update(modules, (current) => R.remove(current, slug)),
    );

  const status = Effect.map(SubscriptionRef.get(components), (current): DevStatus => ({
    protocol: DEV_PROTOCOL,
    components: Arr.sort(
      R.values(current),
      Order.mapInput(Order.String, (entry: DevComponentStatus) => entry.slug),
    ),
  }));

  const state: DevServerState = { components, modules, describe, rebuild, remove, status };
  return state;
});

/** Length-checked constant-time string comparison. */
const timingSafeEqual = (a: string, b: string): boolean =>
  a.length === b.length &&
  Arr.reduce(
    Arr.makeBy(a.length, (index) => a.charCodeAt(index) ^ b.charCodeAt(index)),
    0,
    (mismatch, difference) => mismatch | difference,
  ) === 0;

const CORS = { "access-control-allow-origin": "*" } as const;

const PREFLIGHT = HttpServerResponse.empty({
  status: 204,
  headers: {
    ...CORS,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "authorization",
    "access-control-allow-private-network": "true",
    "access-control-max-age": "600",
  },
});

const NOT_FOUND = HttpServerResponse.jsonUnsafe(
  { error: "not found" },
  { status: 404, headers: CORS },
);

const UNAUTHORIZED = HttpServerResponse.jsonUnsafe(
  { error: "unauthorized" },
  { status: 401, headers: CORS },
);

/**
 * The dev server's routes over `state`, for requests carrying `token` as
 * `Authorization: Bearer <token>`.
 */
export const DevServerRoutes = (options: {
  readonly state: DevServerState;
  readonly token: string;
}) =>
  HttpRouter.use((router) =>
    Effect.gen(function* () {
      const { state } = options;
      const guarded = <E, R>(handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
        Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
          const header = request.headers["authorization"] ?? "";
          const bearer = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
          // An empty token never authorizes, even against a server given one.
          return bearer !== "" && timingSafeEqual(bearer, options.token)
            ? handler
            : Effect.succeed(UNAUTHORIZED);
        });

      const wasm = (kind: "module" | "panel") =>
        guarded(
          Effect.gen(function* () {
            const { hash } = yield* HttpRouter.params;
            const builds = R.values(yield* Ref.get(state.modules)).flat();
            const found = Arr.findFirst(builds, (build) =>
              Option.filter(
                kind === "module" ? Option.some(build.module) : build.panel,
                (entry) => entry.hash === hash,
              ),
            );
            return Option.match(found, {
              onNone: () => NOT_FOUND,
              onSome: ({ bytes }) =>
                HttpServerResponse.uint8Array(bytes, {
                  contentType: "application/wasm",
                  headers: { ...CORS, "cache-control": "public, max-age=31536000, immutable" },
                }),
            });
          }),
        );

      yield* router.add(
        "GET",
        "/v1/status",
        guarded(
          Effect.map(state.status, (status) =>
            HttpServerResponse.text(encodeStatus(status), {
              contentType: "application/json",
              headers: { ...CORS, "cache-control": "no-store" },
            }),
          ),
        ),
      );
      yield* router.add("GET", "/v1/modules/:hash", wasm("module"));
      yield* router.add("GET", "/v1/panels/:hash", wasm("panel"));
      // Browsers preflight every path; anything else is unknown.
      yield* router.add(
        "*",
        "*",
        Effect.map(HttpServerRequest.HttpServerRequest, (request) =>
          request.method === "OPTIONS" ? PREFLIGHT : NOT_FOUND,
        ),
      );
    }),
  );
