import { describe, expect, it } from "vite-plus/test";
import { Context, Effect } from "effect";
import * as Tracer from "effect/Tracer";

import { identityAttributes, withIdentity, type IdentitySource } from "./Telemetry.ts";

const userSession: IdentitySource = {
  method: "user",
  user: { id: "user_1", workosUserId: "wos_user_1", role: "admin" },
  person: null,
  organizations: [
    { id: "org_1", slug: "acme", workosOrganizationId: "wos_org_1" },
    { id: "org_2", slug: "beta", workosOrganizationId: null },
  ],
  projects: [{ id: "proj_1", slug: "web", organizationId: "org_1" }],
};

const secretKeySession: IdentitySource = {
  method: "secret-key",
  user: null,
  person: null,
  organizations: [],
  projects: [{ id: "proj_9", slug: "sdk", organizationId: "org_9" }],
};

const publishableKeySession: IdentitySource = {
  method: "publishable-key",
  user: null,
  person: { distinctId: "distinct_42" },
  organizations: [],
  projects: [{ id: "proj_9", slug: "sdk", organizationId: "org_9" }],
};

const attrMap = (session: IdentitySource): Map<string, string> =>
  new Map(identityAttributes(session).map(([k, v]) => [k, v]));

describe("identityAttributes", () => {
  it("stamps the acting user, first org/project, and counts for a user session", () => {
    const attrs = attrMap(userSession);
    expect(attrs.get("voidhash.auth.method")).toBe("user");
    expect(attrs.get("voidhash.user.id")).toBe("user_1");
    expect(attrs.get("voidhash.user.external_id")).toBe("wos_user_1");
    expect(attrs.get("voidhash.user.role")).toBe("admin");
    // First org is stamped; count signals there are more.
    expect(attrs.get("voidhash.organization.id")).toBe("org_1");
    expect(attrs.get("voidhash.organization.slug")).toBe("acme");
    expect(attrs.get("voidhash.organization.external_id")).toBe("wos_org_1");
    expect(attrs.get("voidhash.organization.count")).toBe("2");
    expect(attrs.get("voidhash.project.id")).toBe("proj_1");
    expect(attrs.get("voidhash.project.organization_id")).toBe("org_1");
    expect(attrs.get("voidhash.project.count")).toBe("1");
    // No person on a user session.
    expect(attrs.has("voidhash.person.distinct_id")).toBe(false);
  });

  it("stamps the scoped project (and its org) for a secret-key session, no user", () => {
    const attrs = attrMap(secretKeySession);
    expect(attrs.get("voidhash.auth.method")).toBe("secret-key");
    expect(attrs.has("voidhash.user.id")).toBe(false);
    expect(attrs.has("voidhash.person.distinct_id")).toBe(false);
    expect(attrs.get("voidhash.project.id")).toBe("proj_9");
    expect(attrs.get("voidhash.project.organization_id")).toBe("org_9");
    expect(attrs.get("voidhash.organization.count")).toBe("0");
  });

  it("stamps the person distinct id for a publishable-key session", () => {
    const attrs = attrMap(publishableKeySession);
    expect(attrs.get("voidhash.auth.method")).toBe("publishable-key");
    expect(attrs.get("voidhash.person.distinct_id")).toBe("distinct_42");
    expect(attrs.get("voidhash.project.id")).toBe("proj_9");
  });

  it("omits nullable fields rather than emitting the string null", () => {
    const attrs = attrMap({
      method: "user",
      user: { id: "user_2", workosUserId: null, role: null },
      person: null,
      organizations: [{ id: "org_3", slug: "solo", workosOrganizationId: null }],
      projects: [],
    });
    expect(attrs.has("voidhash.user.external_id")).toBe(false);
    expect(attrs.has("voidhash.user.role")).toBe(false);
    expect(attrs.has("voidhash.organization.external_id")).toBe(false);
    expect(attrs.has("voidhash.project.id")).toBe(false);
    expect(attrs.get("voidhash.project.count")).toBe("0");
  });
});

/** Minimal in-memory tracer that records every attribute stamped on each span. */
const makeRecordingTracer = () => {
  const spans = new Map<string, Map<string, unknown>>();
  let counter = 0;
  const tracer = Tracer.make({
    span(options) {
      const attributes = new Map<string, unknown>();
      const id = `span-${counter++}`;
      spans.set(options.name, attributes);
      const span: Tracer.Span = {
        _tag: "Span",
        name: options.name,
        spanId: id,
        traceId: "trace",
        parent: options.parent,
        annotations: Context.empty(),
        status: { _tag: "Started", startTime: options.startTime },
        attributes,
        links: options.links,
        sampled: options.sampled,
        kind: options.kind,
        end() {},
        attribute(key, value) {
          attributes.set(key, value);
        },
        event() {},
        addLinks() {},
      };
      return span;
    },
  });
  return { tracer, spans };
};

describe("withIdentity", () => {
  it("annotates identity attributes onto the current span", () => {
    const { tracer, spans } = makeRecordingTracer();

    return Effect.runPromise(
      withIdentity(userSession, Effect.void).pipe(
        Effect.withSpan("rpc.test"),
        Effect.withTracer(tracer),
        Effect.map(() => {
          const attrs = spans.get("rpc.test");
          expect(attrs).toBeDefined();
          expect(attrs?.get("voidhash.user.id")).toBe("user_1");
          expect(attrs?.get("voidhash.organization.id")).toBe("org_1");
          expect(attrs?.get("voidhash.project.id")).toBe("proj_1");
          expect(attrs?.get("voidhash.auth.method")).toBe("user");
        }),
      ),
    );
  });
});
