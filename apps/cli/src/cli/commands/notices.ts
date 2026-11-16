import type {
  NoticeCategory,
  NoticeJsonEncoding,
  NoticePreferencesJsonEncoding,
} from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError, ExitCode, userError } from "../../utils/error-formatter";
import {
  formatTable,
  formatTimeAgo,
  outputModeOf,
  printIds,
  printJson,
  printTable,
} from "../output";
import { outputOptions } from "../shared-options";
import { organizationKind, organizationOption, resolveOrganization } from "./workspace";

const CATEGORIES = [
  "billing",
  "legal",
  "security",
  "account",
  "integrations",
  "product",
] as const satisfies ReadonlyArray<NoticeCategory>;

const noticeIds = Argument.String("notice").pipe(
  Argument.withDescription("A notice's id, as 'voidhash-cli notices list' shows; repeat for each"),
  Argument.atLeast(0),
);

/** `voidhash-cli notices list [--archived] [--org]` */
const noticesListCommand = Command.make(
  "list",
  {
    archived: Flag.Boolean("archived").pipe(
      Flag.withDescription("List the archive instead of the inbox"),
      Flag.withDefault(false),
    ),
    org: organizationOption,
    ...outputOptions,
  },
  ({ archived, json, org, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const notices = yield* readAll((query) =>
        api.noticesList(organization.id, { ...query, isArchived: archived ? "true" : "false" }),
      );
      if (mode === "json") return yield* printJson(notices);
      if (mode === "quiet") return yield* printIds(notices);
      const now = yield* DateTime.now;
      const marker = (notice: NoticeJsonEncoding) =>
        notice.isUrgent && notice.resolvedAt === null ? "!" : notice.readAt === null ? "•" : " ";
      yield* printTable(
        [
          { header: " ", cell: marker },
          { header: "WHEN", cell: (notice) => formatTimeAgo(notice.createdAt, now) },
          { header: "CATEGORY", cell: (notice) => notice.category },
          { header: "TITLE", cell: (notice) => notice.title },
          { header: "ID", cell: (notice) => notice.id },
        ],
        notices,
        archived
          ? `Nothing archived in ${organizationKind.label(organization)}.`
          : `No notices from ${organizationKind.label(organization)}.`,
      );
      if (notices.some((notice) => notice.readAt === null || notice.isUrgent)) {
        yield* Console.error(
          "• unread, ! needs action. Mark them read with 'voidhash-cli notices read --all'.",
        );
      }
    }),
).pipe(
  Command.withDescription(
    "List the notices an organization sent you, such as billing and security notices, newest first.",
  ),
);

/** `voidhash-cli notices read [<notice>…|--all] [--org]` */
const noticesReadCommand = Command.make(
  "read",
  {
    notices: noticeIds,
    all: Flag.Boolean("all").pipe(
      Flag.withDescription("Mark the whole inbox read"),
      Flag.withDefault(false),
    ),
    org: organizationOption,
    json: outputOptions.json,
  },
  ({ all, json, notices, org }) =>
    Effect.gen(function* () {
      if (all === Arr.isReadonlyArrayNonEmpty(notices)) {
        return yield* Effect.fail(
          userError("Name the notices to mark read, or pass --all.", {
            hint: "Run it as: voidhash-cli notices read <notice>… or voidhash-cli notices read --all",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const unread = yield* api.noticesMarkRead(organization.id, all ? {} : { noticeIds: notices });
      if (json) return yield* printJson(unread);
      yield* Console.log(`Marked read. ${unread.count} unread left.`);
    }),
).pipe(Command.withDescription("Mark notices read, or the whole inbox with --all."));

/** `voidhash-cli notices archive|unarchive <notice>… [--org]` */
const noticesArchiveCommand = (isArchiving: boolean) =>
  Command.make(
    isArchiving ? "archive" : "unarchive",
    { notices: noticeIds, org: organizationOption, json: outputOptions.json },
    ({ json, notices, org }) =>
      Effect.gen(function* () {
        if (Arr.isReadonlyArrayEmpty(notices)) {
          return yield* Effect.fail(
            userError(`Name the notices to ${isArchiving ? "archive" : "bring back"}.`, {
              hint: `Run it as: voidhash-cli notices ${isArchiving ? "archive" : "unarchive"} <notice>…`,
              exitCode: ExitCode.usage,
            }),
          );
        }
        const api = yield* ApiClient;
        const organization = yield* resolveOrganization(org);
        const unread = yield* (isArchiving ? api.noticesArchive : api.noticesUnarchive)(
          organization.id,
          { noticeIds: notices },
        );
        if (json) return yield* printJson(unread);
        yield* Console.log(
          `${isArchiving ? "Archived" : "Moved back to the inbox"}. ${unread.count} unread left.`,
        );
      }),
  ).pipe(
    Command.withDescription(
      isArchiving
        ? "Archive notices, which also marks them read."
        : "Bring archived notices back to the inbox.",
    ),
  );

const preferencesTable = (preferences: NoticePreferencesJsonEncoding) =>
  formatTable(
    [
      { header: "CATEGORY", cell: (category) => category.category },
      { header: "INBOX", cell: (category) => (category.isInboxEnabled ? "on" : "off") },
      { header: "EMAIL", cell: (category) => (category.isEmailEnabled ? "on" : "off") },
      {
        header: "",
        cell: (category) => (category.isMandatory ? "always on" : ""),
      },
    ],
    preferences.categories,
  );

/** `voidhash-cli notices preferences [--category <c> --inbox on|off --email on|off] [--locale]` */
const noticesPreferencesCommand = Command.make(
  "preferences",
  {
    category: Flag.Literals("category", CATEGORIES).pipe(
      Flag.withDescription("The category to change, with --inbox or --email"),
      Flag.optional,
    ),
    inbox: Flag.Literals("inbox", ["on", "off"]).pipe(
      Flag.withDescription("Whether its notices appear in your inbox"),
      Flag.optional,
    ),
    email: Flag.Literals("email", ["on", "off"]).pipe(
      Flag.withDescription("Whether its notices are emailed to you"),
      Flag.optional,
    ),
    locale: Flag.Literals("locale", ["en", "cs"]).pipe(
      Flag.withDescription("The language of your notices, in every organization"),
      Flag.optional,
    ),
    org: organizationOption,
    json: outputOptions.json,
  },
  ({ category, email, inbox, json, locale, org }) =>
    Effect.gen(function* () {
      const changesChannel = Option.isSome(inbox) || Option.isSome(email);
      if (changesChannel !== Option.isSome(category)) {
        return yield* Effect.fail(
          userError("Pass --category with --inbox or --email.", {
            hint: "Run it as: voidhash-cli notices preferences --category product --email off",
            exitCode: ExitCode.usage,
          }),
        );
      }
      const api = yield* ApiClient;
      const organization = yield* resolveOrganization(org);
      const preferences =
        Option.isNone(category) && Option.isNone(locale)
          ? yield* api.noticesGetPreferences(organization.id)
          : yield* api
              .noticesUpdatePreferences(organization.id, {
                locale: Option.getOrUndefined(locale),
                categories: Option.match(category, {
                  onNone: () => undefined,
                  onSome: (name) => [
                    {
                      category: name,
                      isInboxEnabled: Option.getOrUndefined(Option.map(inbox, (v) => v === "on")),
                      isEmailEnabled: Option.getOrUndefined(Option.map(email, (v) => v === "on")),
                    },
                  ],
                }),
              })
              .pipe(
                Effect.mapError((error) =>
                  apiError(error, {
                    notice_category_mandatory:
                      "Billing, legal and security notices always reach you; only the other categories can be turned off.",
                  }),
                ),
              );
      if (json) return yield* printJson(preferences);
      yield* Console.log(
        [
          `How ${organizationKind.label(organization)} reaches you (notices in ${preferences.locale === "cs" ? "Czech" : "English"}):`,
          preferencesTable(preferences),
        ].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Show or change how each category of notices reaches you, and their language.",
  ),
);

/** `voidhash-cli notices …` */
export const noticesCommand = Command.make("notices").pipe(
  Command.withAlias("notice"),
  Command.withDescription(
    "Notices your organizations sent you: list them, mark them read, archive them, choose how they reach you.",
  ),
  Command.withSubcommands([
    noticesListCommand,
    noticesReadCommand,
    noticesArchiveCommand(true),
    noticesArchiveCommand(false),
    noticesPreferencesCommand,
  ]),
);
