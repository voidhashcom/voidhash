/**
 * How the team and settings commands name and describe what they act on:
 * organizations, members, tracking domains, persons and push services, the
 * organization a command acts on, and the logo files `edit --logo` reads.
 */
import type {
  OrganizationMemberJsonEncoding,
  OrganizationMemberRole,
  PushNotificationProviderType,
  TrackingDomainJsonEncoding,
  TrackingDomainStatus,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import { Base64 } from "effect/encoding";
import { Flag } from "effect/cli";

import { ExitCode, userError } from "../../utils/error-formatter";
import {
  directoryConfig,
  linkFor,
  projectNamedBy,
  readCliConfig,
  signedInSession,
} from "../context";
import { chooseItem, findItem, isInteractive, type ItemKind } from "../input";

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

interface NamedOrganization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export const organizationKind: ItemKind<NamedOrganization> = {
  noun: "organization",
  label: (organization) => `${organization.name} (${organization.slug})`,
  listCommand: "voidhash-cli org list",
  createCommand: "voidhash-cli org create",
  keys: (organization) => [organization.slug],
  names: (organization) => [organization.name],
};

/** `--org` for a command that acts on an organization. */
export const organizationOption = Flag.String("org").pipe(
  Flag.withDescription(
    "Organization to act on: its slug, name or id (default: the organization of this directory's or your default project)",
  ),
  Flag.optional,
);

/**
 * The organization an organization-scoped command acts on: the one `flag`
 * names; else the only one the session can use; else the organization of the
 * project this directory names or is linked to, or of the default project;
 * else the person chooses on a terminal. Never asks for a project.
 */
export const resolveOrganization = Effect.fn("resolveOrganization")(function* (
  flag: Option.Option<string>,
) {
  const session = yield* signedInSession;
  const organizations = session.organizations;
  if (Option.isSome(flag)) return yield* findItem(organizationKind, organizations, flag.value);
  const [only, ...others] = organizations;
  if (only !== undefined && Arr.isReadonlyArrayEmpty(others)) return only;
  if (only === undefined) {
    return yield* Effect.fail(
      userError("This credential belongs to no organization.", {
        hint: "Sign in as yourself with 'voidhash-cli auth login', or create one with 'voidhash-cli org create'.",
        exitCode: ExitCode.notFound,
      }),
    );
  }

  const config = yield* directoryConfig;
  const path = yield* Path.Path;
  const cliConfig = yield* readCliConfig;
  const configured = Option.isSome(config)
    ? Option.some((yield* projectNamedBy(config.value, session)).project.organizationId)
    : Option.none<string>();
  const linked = Option.map(
    linkFor(cliConfig.links ?? {}, path.resolve("."), path.sep),
    ({ projectId }) => projectId,
  );
  const stored = Option.orElse(linked, () =>
    P.isString(cliConfig.default_project) ? Option.some(cliConfig.default_project) : Option.none(),
  );
  const organizationId = Option.orElse(configured, () =>
    Option.flatMap(stored, (projectId) =>
      Option.map(
        Arr.findFirst(session.projects, ({ id }) => id === projectId),
        ({ organizationId }) => organizationId,
      ),
    ),
  );
  const contextual = Option.flatMap(organizationId, (id) =>
    Arr.findFirst(organizations, (organization) => organization.id === id),
  );
  if (Option.isSome(contextual)) return contextual.value;

  if (!(yield* isInteractive)) {
    return yield* Effect.fail(
      userError(
        [
          `Which organization? You belong to ${organizations.length}:`,
          ...organizations.map((organization) => `  ${organizationKind.label(organization)}`),
        ].join("\n"),
        { hint: "Pass --org <organization>.", exitCode: ExitCode.usage },
      ),
    );
  }
  return yield* chooseItem(organizationKind, organizations);
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const memberKind: ItemKind<OrganizationMemberJsonEncoding> = {
  noun: "member",
  label: (member) => `${member.name} <${member.email}>`,
  listCommand: "voidhash-cli member list",
  createCommand: "voidhash-cli member invite",
  keys: (member) => [member.email, member.userId],
  names: (member) => [member.name],
};

/** How a role reads, with what it allows. */
export const ROLE_LABELS: Readonly<Record<OrganizationMemberRole, string>> = {
  owner: "owner",
  admin: "admin",
  member: "member",
};

/** The roles `member role` and `member invite --role` take. */
export const ASSIGNABLE_ROLES = [
  ["admin", "admin"],
  ["member", "member"],
] as const;

// ---------------------------------------------------------------------------
// Tracking domains
// ---------------------------------------------------------------------------

export const trackingDomainKind: ItemKind<TrackingDomainJsonEncoding> = {
  noun: "tracking domain",
  label: (domain) => domain.hostname,
  listCommand: "voidhash-cli domain list",
  createCommand: "voidhash-cli domain add",
  keys: (domain) => [domain.hostname],
  names: () => [],
};

/** Where a tracking domain's setup stands, as people say it. */
export const DOMAIN_STATUS_LABELS: Readonly<Record<TrackingDomainStatus, string>> = {
  pending_dns: "waiting for DNS",
  pending_certificate: "waiting for its certificate",
  active: "active",
  failed: "failed",
};

// ---------------------------------------------------------------------------
// Push services
// ---------------------------------------------------------------------------

/** The push services as commands take them. */
export const PUSH_SERVICES = [
  ["apns", "apns"],
  ["fcm", "fcm"],
] as const satisfies ReadonlyArray<readonly [string, PushNotificationProviderType]>;

export const PUSH_SERVICE_LABELS: Readonly<Record<PushNotificationProviderType, string>> = {
  apns: "Apple Push Notification service",
  fcm: "Firebase Cloud Messaging",
};

// ---------------------------------------------------------------------------
// Logos
// ---------------------------------------------------------------------------

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** `--logo` and `--remove-logo` for an `edit` command. */
export const logoOptions = {
  logo: Flag.String("logo").pipe(
    Flag.withDescription("A PNG, JPEG or WebP image of up to 2 MB to use as the logo"),
    Flag.optional,
  ),
  removeLogo: Flag.Boolean("remove-logo").pipe(
    Flag.withDescription("Remove the logo"),
    Flag.withDefault(false),
  ),
};

/** The image at `file` as the avatar body the API takes. */
export const readLogo = (file: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const contentType = IMAGE_TYPES[path.extname(file).toLowerCase()];
    if (contentType === undefined) {
      return yield* Effect.fail(
        userError(`${file} is not a PNG, JPEG or WebP image.`, { exitCode: ExitCode.usage }),
      );
    }
    const bytes = yield* (yield* FileSystem.FileSystem)
      .readFile(file)
      .pipe(
        Effect.mapError(() => userError(`Could not read ${file}.`, { exitCode: ExitCode.usage })),
      );
    return { contentType, imageBase64: Base64.encode(bytes) };
  });

/** A random id for a request that must apply once: a sandbox action, a push send. */
export const randomId = Effect.sync(() => crypto.randomUUID());
