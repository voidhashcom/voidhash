import * as Schema from "effect/Schema";
import { generateId } from "@voidhash/core/utils/generate-id";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Headers from "effect/unstable/http/Headers";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as R from "effect/Record";

/**
 * Request-context OpenTelemetry helpers for the backend HTTP/RPC handler.
 *
 * The tracer Layer itself is provided at the Worker fetch-graph root
 * (`stacks/backend/workers/BackendWorker.ts`); these helpers run inside the
 * request span created by `HttpMiddleware.tracer` and stamp the cross-cutting
 * attributes that make a request traceable end-to-end. With Effect's default
 * no-op tracer (dev / tests) every call here is a cheap no-op.
 *
 * See `docs/attribute-registry.md` for the canonical attribute set.
 */

const REQUEST_ID_HEADER = "x-request-id";

/** Stable, greppable prefix so request ids are obvious in logs and Axiom. */
const generateRequestId = (): string => generateId("request");

/**
 * HTTP middleware that establishes the per-request correlation id. Reads an
 * inbound `x-request-id` (propagated by callers such as `apps/www`) or mints a
 * fresh one, stamps it on the current request span as `voidhash.request.id`,
 * annotates every log emitted while handling the request, and echoes it back on
 * the response so clients can quote it in bug reports.
 *
 * Apply it *inside* `HttpMiddleware.tracer` so the request span already exists.
 */
export const withRequestId = <E, R>(
  httpApp: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    HttpServerRequest.HttpServerRequest | R
  >,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E,
  HttpServerRequest.HttpServerRequest | R
> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const requestId = Option.getOrElse(
      Headers.get(request.headers, REQUEST_ID_HEADER),
      generateRequestId,
    );
    yield* Effect.annotateCurrentSpan("voidhash.request.id", requestId);
    const response = yield* Effect.annotateLogs(httpApp, "voidhash.request.id", requestId);
    return HttpServerResponse.setHeader(response, REQUEST_ID_HEADER, requestId);
  });

/**
 * Structural view of an authenticated session, satisfied by both the RPC
 * `UserSession` (`@voidhash/rpc`) and the HTTP API sessions
 * (`@voidhash/api-contracts`). Declared locally so this module couples to
 * neither package's exact schema.
 */
export interface IdentitySource {
  readonly method: string;
  readonly user:
    | {
        readonly id: string;
        readonly workosUserId?: string | typeof Schema.Null.Type;
        readonly role?: string | typeof Schema.Null.Type;
      }
    | typeof Schema.Null.Type;
  readonly person: { readonly distinctId: string } | typeof Schema.Null.Type;
  readonly organizations: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly workosOrganizationId?: string | typeof Schema.Null.Type;
  }>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly organizationId: string;
  }>;
}

/**
 * The canonical identity attributes for a session — the per-request set defined
 * in `docs/attribute-registry.md` §2b. Stamps the authenticated principal
 * (user / person + auth method), the active/first organization and project, and
 * `*.count` cardinality breadcrumbs so a multi-org/multi-project session is
 * flagged without dumping every id. Nullable fields are omitted (never emitted
 * as the string `"null"`). A request's *target* entity — when it differs from
 * the principal's first org/project — is stamped on the domain service span
 * instead.
 */
export const identityAttributes = (
  session: IdentitySource,
): ReadonlyArray<readonly [string, string]> => {
  const attrs: Array<readonly [string, string]> = [
    ["voidhash.auth.method", session.method],
    ["voidhash.organization.count", String(session.organizations.length)],
    ["voidhash.project.count", String(session.projects.length)],
  ];

  if (session.user) {
    attrs.push(["voidhash.user.id", session.user.id]);
    if (session.user.workosUserId)
      attrs.push(["voidhash.user.external_id", session.user.workosUserId]);
    if (session.user.role) attrs.push(["voidhash.user.role", session.user.role]);
  }
  if (session.person) attrs.push(["voidhash.person.distinct_id", session.person.distinctId]);

  const org = session.organizations[0];
  if (org) {
    attrs.push(["voidhash.organization.id", org.id], ["voidhash.organization.slug", org.slug]);
    if (org.workosOrganizationId) {
      attrs.push(["voidhash.organization.external_id", org.workosOrganizationId]);
    }
  }

  const project = session.projects[0];
  if (project) {
    attrs.push(
      ["voidhash.project.id", project.id],
      ["voidhash.project.slug", project.slug],
      ["voidhash.project.organization_id", project.organizationId],
    );
  }

  return attrs;
};

/**
 * Stamp the {@link identityAttributes} for `session` onto the current span and
 * onto every log emitted while running `effect`. Call this in the auth
 * middleware around the handler effect (right where `AuthSession` is provided)
 * so every span and log under an authenticated request carries the principal.
 */
export const withIdentity = <A, E, R>(
  session: IdentitySource,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
  const attrs = identityAttributes(session);
  const annotateSpan = Effect.forEach(
    attrs,
    ([key, value]) => Effect.annotateCurrentSpan(key, value),
    { concurrency: 1, discard: true },
  );
  return annotateSpan.pipe(Effect.andThen(Effect.annotateLogs(effect, R.fromEntries(attrs))));
};
