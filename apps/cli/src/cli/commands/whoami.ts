import type { CredentialKind } from "@voidhash/generated-clients";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { Command } from "effect/cli";
import * as Option from "effect/Option";

import { Credentials, describeCredentialSource } from "../../domain/services/credentials";
import { printable } from "../../utils/printable";
import { projectKind, readCliConfig, signedInSession } from "../context";
import { formatFields, printJson } from "../output";
import { outputOptions } from "../shared-options";

/** How each kind of credential reads after "with". */
const CREDENTIALS: Readonly<Record<CredentialKind, string>> = {
  cli_key: "this computer's CLI key",
  secret_key: "a project secret key",
  mcp_client: "an MCP connection",
  dashboard_session: "a dashboard session",
};

/**
 * Who the credential signs in as, on which server and where the credential
 * came from, and what it can use; the
 * session object with `json`. Fails with exit code 3 when no one is signed in.
 */
export const showSession = (json: boolean) =>
  Effect.gen(function* () {
    const session = yield* signedInSession;
    if (json) return yield* printJson(session);
    const { api_url } = yield* readCliConfig;
    const credentials = yield* Credentials;
    const credential = yield* credentials
      .resolve(api_url)
      .pipe(Effect.option, Effect.map(Option.flatten));
    const kind = projectKind(session);
    const who =
      session.person === null
        ? "a project secret key"
        : `${printable(session.person.name)} <${printable(session.person.email)}> with ${CREDENTIALS[session.kind]}`;
    yield* Console.log(
      [
        `Signed in as ${who} on ${api_url}.`,
        ...Arr.fromOption(
          Option.map(
            credential,
            ({ origin, source }) =>
              `Credential for ${origin} from ${describeCredentialSource(source, credentials.filePath)}.`,
          ),
        ),
        ...(session.isReadOnly
          ? [
              "Read-only: the CLI can look but not change anything. Change it under Settings → Devices and apps in the dashboard.",
            ]
          : []),
        "",
        formatFields([
          [
            "Organizations",
            Arr.match(session.organizations, {
              onEmpty: () => "none",
              onNonEmpty: (organizations) =>
                organizations.map(({ name, slug }) => `${name} (${slug})`).join("\n"),
            }),
          ],
          [
            "Projects",
            Arr.match(session.projects, {
              onEmpty: () => "none",
              onNonEmpty: (projects) => projects.map(kind.label).join("\n"),
            }),
          ],
        ]),
        "",
        "'voidhash-cli status' shows the project commands act on here.",
      ].join("\n"),
    );
  });

/** `voidhash-cli whoami [--json]` */
export const whoamiCommand = Command.make("whoami", { json: outputOptions.json }, ({ json }) =>
  showSession(json),
).pipe(
  Command.withDescription(
    "Show who the CLI is signed in as, and the organizations and projects it can use.",
  ),
);
