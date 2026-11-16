import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import { signedInSession } from "../context";
import { confirmChange, requireChoice, requireItem, requireText } from "../input";
import { formatTimeAgo, outputModeOf, printIds, printItem, printJson, printTable } from "../output";
import { outputOptions, yesOption } from "../shared-options";
import {
  ASSIGNABLE_ROLES,
  memberKind,
  organizationKind,
  organizationOption,
  resolveOrganization,
} from "./workspace";

const memberArgument = Argument.String("member").pipe(
  Argument.withDescription("The member's email, name or id"),
  Argument.optional,
);

/** Why the API refuses to change the owner or the last administrator, and what to do instead. */
const OWNER_HINT =
  "The owner cannot be demoted or removed, and neither can the last admin; make someone else an admin in the Voidhash dashboard first.";

/**
 * The refusal of a command asked to make someone an administrator: the API
 * lets only the person, signed in to the dashboard or the mobile app, do that,
 * never the CLI acting for them.
 */
const adminRefused = () =>
  userError("The CLI cannot make someone an admin.", {
    hint: "Make them an admin in the Voidhash dashboard, where you are signed in as yourself.",
    exitCode: ExitCode.usage,
  });

/** `voidhash-cli member list [--org]` */
const memberListCommand = Command.make(
  "list",
  { org: organizationOption, ...outputOptions },
  ({ json, org, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const members = yield* readAll((query) =>
        api.organizationMembersList(organization.id, query),
      );
      if (mode === "json") return yield* printJson(members);
      if (mode === "quiet") return yield* printIds(members);
      const session = yield* signedInSession;
      const now = yield* DateTime.now;
      yield* printTable(
        [
          {
            header: "NAME",
            cell: (member) =>
              member.userId === session.person?.id ? `${member.name} (you)` : member.name,
          },
          { header: "EMAIL", cell: (member) => member.email },
          { header: "ROLE", cell: (member) => member.role },
          { header: "JOINED", cell: (member) => formatTimeAgo(member.createdAt, now) },
          { header: "ID", cell: (member) => member.id },
        ],
        members,
        `${organizationKind.label(organization)} has no members you can see.`,
      );
    }),
).pipe(Command.withDescription("List an organization's members and their roles."));

/** `voidhash-cli member invite [email] [--role] [--org]` */
const memberInviteCommand = Command.make(
  "invite",
  {
    email: Argument.String("email").pipe(
      Argument.withDescription("The email of their Voidhash account"),
      Argument.optional,
    ),
    role: Flag.ChoiceWithValue("role", ASSIGNABLE_ROLES).pipe(
      Flag.withDescription(
        "Their role: member (the default). Making someone an admin is done in the Voidhash dashboard.",
      ),
      Flag.withDefault("member" as const),
    ),
    org: organizationOption,
    ...outputOptions,
  },
  ({ email, json, org, quiet, role }) =>
    Effect.gen(function* () {
      if (role === "admin") return yield* Effect.fail(adminRefused());
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const address = yield* requireText(email, {
        flag: "the email",
        message: "Email of their Voidhash account",
        usage: "voidhash-cli member invite <email>",
      });
      const member = yield* api.organizationMembersCreate(organization.id, { email: address }).pipe(
        Effect.mapError((error) =>
          apiError(error, {
            invitee_has_no_account: `Invite them by email from the dashboard, under Settings → Members. If they sign up with ${address} and verify it, this command can add them too.`,
          }),
        ),
      );
      yield* printItem(
        mode,
        member,
        `${memberKind.label(member)} is ${member.role === "member" ? "a member" : `an ${member.role}`} of ${organizationKind.label(organization)} and can use its projects now.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Add someone with a Voidhash account to the organization as a member. Adding a member again keeps their role.",
  ),
);

/** `voidhash-cli member role [member] [role] [--org] [--yes]` */
const memberRoleCommand = Command.make(
  "role",
  {
    member: memberArgument,
    role: Argument.Literals("role", ["admin", "member"]).pipe(
      Argument.withDescription(
        "member makes an admin a member, who uses its projects. Making someone an admin is done in the Voidhash dashboard.",
      ),
      Argument.optional,
    ),
    org: organizationOption,
    yes: yesOption,
    ...outputOptions,
  },
  ({ json, member, org, quiet, role, yes }) =>
    Effect.gen(function* () {
      if (Option.contains(role, "admin")) return yield* Effect.fail(adminRefused());
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const members = yield* readAll((query) =>
        api.organizationMembersList(organization.id, query),
      );
      const usage = "voidhash-cli member role <member> member";
      const found = yield* requireItem(memberKind, members, member, usage);
      const wanted = yield* requireChoice(role, {
        flag: "the role",
        message: `Role of ${memberKind.label(found)} (making someone an admin is done in the Voidhash dashboard)`,
        usage,
        choices: [{ title: "member: uses its projects", value: "member" as const }],
      });
      if (found.role === "owner") {
        return yield* Effect.fail(
          userError(`${memberKind.label(found)} owns ${organizationKind.label(organization)}.`, {
            hint: "The owner's role cannot change.",
          }),
        );
      }
      if (found.role === wanted) {
        return yield* printItem(mode, found, `${memberKind.label(found)} is already ${wanted}.`);
      }
      if (wanted === "member") {
        yield* confirmChange({
          yes,
          message: `Make ${memberKind.label(found)} a member of ${organizationKind.label(organization)}? They can no longer manage its team or settings.`,
        });
      }
      const updated = yield* api
        .organizationMembersUpdate(organization.id, found.id, { role: wanted })
        .pipe(Effect.mapError((error) => apiError(error, { permission_denied: OWNER_HINT })));
      yield* printItem(mode, updated, `${memberKind.label(updated)} is ${updated.role} now.`);
    }),
).pipe(
  Command.withDescription(
    "Make an admin a member (which asks first; --yes skips that). Making someone an admin is done in the Voidhash dashboard.",
  ),
);

/** `voidhash-cli member remove [member] [--org] [--yes]` */
const memberRemoveCommand = Command.make(
  "remove",
  { member: memberArgument, org: organizationOption, yes: yesOption, ...outputOptions },
  ({ json, member, org, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const members = yield* readAll((query) =>
        api.organizationMembersList(organization.id, query),
      );
      const found = yield* requireItem(
        memberKind,
        members,
        member,
        "voidhash-cli member remove <member> --yes",
      );
      if (found.role === "owner") {
        return yield* Effect.fail(
          userError(`${memberKind.label(found)} owns ${organizationKind.label(organization)}.`, {
            hint: "The owner cannot be removed.",
          }),
        );
      }
      const session = yield* signedInSession;
      const projects = session.projects.filter(
        (project) => project.organizationId === organization.id,
      );
      yield* confirmChange({
        yes,
        message: `Remove ${memberKind.label(found)} from ${organizationKind.label(organization)}? They lose access to ${projects.length === 1 ? "its project" : `all ${projects.length} of its projects`} at once.`,
      });
      yield* api
        .organizationMembersDelete(organization.id, found.id)
        .pipe(Effect.mapError((error) => apiError(error, { permission_denied: OWNER_HINT })));
      yield* printItem(
        mode,
        found,
        `Removed ${memberKind.label(found)} from ${organizationKind.label(organization)}.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Remove someone from the organization; they lose access to its projects. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli member …` */
export const memberCommand = Command.make("member").pipe(
  Command.withAlias("members"),
  Command.withDescription(
    "Your organization's team: list members, invite people, change roles, remove people.",
  ),
  Command.withSubcommands([
    memberListCommand,
    memberInviteCommand,
    memberRoleCommand,
    memberRemoveCommand,
  ]),
);
