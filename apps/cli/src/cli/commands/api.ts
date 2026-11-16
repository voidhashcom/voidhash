import {
  ApiDocument,
  type ApiOperation,
  apiOperationRequest,
  apiOperations,
  apiOperationSummary,
  describeApiOperation,
  searchApiOperations,
} from "@voidhash/api-contracts/operations";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import { Argument, Command, Flag } from "effect/cli";
import { HttpClient, HttpClientRequest } from "effect/http";

import { CliConfig } from "../../domain/services/cli-config";
import { Credentials } from "../../domain/services/credentials";
import { ExitCode, exitCodeForStatus, userError } from "../../utils/error-formatter";
import { resolveProject } from "../context";
import { projectOption } from "../shared-options";

/** JSON text, printed indented. */
const PrettyJson = Schema.fromJsonString(Schema.Unknown, { space: 2 });
const encodePrettyJson = Schema.encodeSync(PrettyJson);
const decodeJson = Schema.decodeUnknownOption(PrettyJson);

/** The API's operation catalog, read from the OpenAPI document of the server the CLI talks to. */
const loadCatalog = Effect.fn("loadCatalog")(function* () {
  const config = yield* (yield* CliConfig)
    .readConfig()
    .pipe(Effect.mapError(() => userError("Could not read the CLI config.")));
  const document = yield* HttpClient.get(new URL("/api/openapi.json", config.api_url)).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(ApiDocument)),
    Effect.mapError(() =>
      userError(`Could not read the API description from ${config.api_url}/api/openapi.json.`),
    ),
  );
  return { config, document, operations: apiOperations(document) };
});

const findOperation = (operations: ReadonlyArray<ApiOperation>, id: string) =>
  Effect.fromOption(Arr.findFirst(operations, (operation) => operation.id === id)).pipe(
    Effect.mapError(() =>
      userError(`There is no operation "${id}".`, {
        hint: "'voidhash-cli api list' shows them.",
        exitCode: ExitCode.notFound,
      }),
    ),
  );

/**
 * Groups `name=value` flag values by name; a repeated name collects its values
 * into a list, in order.
 */
export const parseAssignments = (flag: string, values: ReadonlyArray<string>) =>
  Effect.map(
    Effect.forEach(
      values,
      (value) => {
        const separator = value.indexOf("=");
        return separator > 0
          ? Effect.succeed([value.slice(0, separator), value.slice(separator + 1)] as const)
          : Effect.fail(userError(`--${flag} takes name=value, got "${value}".`));
      },
      { concurrency: 1 },
    ),
    (pairs) =>
      Arr.reduce(
        pairs,
        R.empty<string, string | ReadonlyArray<string>>(),
        (assigned, [name, item]) =>
          R.set(
            assigned,
            name,
            Option.match(R.get(assigned, name), {
              onNone: () => item,
              onSome: (previous): string | ReadonlyArray<string> =>
                P.isString(previous) ? [previous, item] : [...previous, item],
            }),
          ),
      ),
  );

const searchArgument = Argument.String("search").pipe(
  Argument.withDescription("Words that must all appear in the operation id, path or description"),
  Argument.variadic(),
);

const operationArgument = Argument.String("operation").pipe(
  Argument.withDescription("Operation id from `voidhash-cli api list`, e.g. webhooks.list"),
);

/** `voidhash-cli api list [search...] [--json]` */
const apiListCommand = Command.make(
  "list",
  {
    search: searchArgument,
    json: Flag.Boolean("json").pipe(
      Flag.withDescription("Print JSON instead of a list"),
      Flag.withDefault(false),
    ),
  },
  ({ json, search }) =>
    Effect.gen(function* () {
      const { operations } = yield* loadCatalog();
      const matches = searchApiOperations(operations, search.join(" "));
      if (json) {
        yield* Console.log(
          encodePrettyJson(
            matches.map((operation) => ({
              operation: operation.id,
              method: operation.method,
              path: operation.path,
              summary: apiOperationSummary(operation),
            })),
          ),
        );
        return;
      }
      const width = Math.max(0, ...matches.map((operation) => operation.id.length));
      const lines = Arr.flatMap(matches, (operation) => {
        const summary = apiOperationSummary(operation);
        const line = `${operation.id.padEnd(width)}  ${operation.method.padEnd(6)}  ${operation.path}`;
        return summary === "" ? [line] : [line, `${" ".repeat(width + 2)}${summary}`];
      });
      yield* Console.log(
        Arr.match(lines, {
          onEmpty: () => "No operation matches.",
          onNonEmpty: (all) => all.join("\n"),
        }),
      );
    }),
).pipe(Command.withDescription("List the operations of the Voidhash API."));

/** `voidhash-cli api describe <operation>` */
const apiDescribeCommand = Command.make(
  "describe",
  { operation: operationArgument },
  ({ operation: id }) =>
    Effect.gen(function* () {
      const { document, operations } = yield* loadCatalog();
      const operation = yield* findOperation(operations, id);
      yield* Console.log(encodePrettyJson(describeApiOperation(document, operation)));
    }),
).pipe(
  Command.withDescription("Show an operation's parameters, body and response schemas, and errors."),
);

/** A JSON body given inline, or as `@path` to a file. */
const readBody = (body: string) =>
  Effect.gen(function* () {
    const text = body.startsWith("@")
      ? yield* (yield* FileSystem.FileSystem)
          .readFileString(body.slice(1))
          .pipe(Effect.mapError(() => userError(`Could not read the body file ${body.slice(1)}.`)))
      : body;
    return yield* Effect.fromOption(decodeJson(text)).pipe(
      Effect.mapError(() => userError("--body is not valid JSON.")),
    );
  });

/**
 * `voidhash-cli api call <operation> [--path name=value]… [--query name=value]…
 * [--body json|@file] [--project id] [--environment name]`
 */
const apiCallCommand = Command.make(
  "call",
  {
    operation: operationArgument,
    path: Flag.String("path").pipe(
      Flag.withDescription("A path parameter as name=value; repeat for each"),
      Flag.atLeast(0),
    ),
    query: Flag.String("query").pipe(
      Flag.withDescription("A query parameter as name=value; repeat a name for a list"),
      Flag.atLeast(0),
    ),
    body: Flag.String("body").pipe(
      Flag.withDescription("JSON request body, inline or @file.json"),
      Flag.optional,
    ),
    project: projectOption,
    environment: Flag.Literals("environment", ["production", "test", "all"]).pipe(
      Flag.withDescription(
        "Purchases the call sees: production (default; production purchases, and store sandbox ones when they unlock production), test (store sandbox and test purchases, as a test key reads) or all",
      ),
      Flag.optional,
    ),
  },
  ({ body, environment, operation: id, path, project, query }) =>
    Effect.gen(function* () {
      const { config, operations } = yield* loadCatalog();
      const operation = yield* findOperation(operations, id);
      const credential = yield* (yield* Credentials)
        .resolve(config.api_url)
        .pipe(Effect.mapError((error) => userError(error.message)));
      const apiKey = yield* Effect.fromOption(Option.map(credential, ({ token }) => token)).pipe(
        Effect.mapError(() =>
          userError("You are not signed in.", {
            hint: "Run 'voidhash-cli auth login' first.",
            exitCode: ExitCode.unauthenticated,
          }),
        ),
      );
      // A repeated path parameter keeps its last value.
      const pathParameters = R.map(yield* parseAssignments("path", path), (value) =>
        P.isString(value) ? value : Option.getOrElse(Arr.last(value), () => ""),
      );
      const built = apiOperationRequest(operation, {
        pathParameters,
        query: yield* parseAssignments("query", query),
        body: Option.isSome(body) ? Option.some(yield* readBody(body.value)) : Option.none(),
        projectId:
          operation.isProjectScoped && !R.has(pathParameters, "projectId")
            ? Option.some((yield* resolveProject(project)).project.id)
            : Option.none(),
      });
      if ("problem" in built) return yield* Effect.fail(userError(built.problem));
      const { request } = built;

      const response = yield* HttpClient.execute(
        HttpClientRequest.make(operation.method)(new URL(request.url, config.api_url)).pipe(
          HttpClientRequest.setHeader("authorization", `Bearer ${apiKey}`),
          (outgoing) =>
            Option.match(environment, {
              onNone: () => outgoing,
              onSome: (name) => HttpClientRequest.setHeader(outgoing, "x-environment", name),
            }),
          (outgoing) =>
            Option.match(request.body, {
              onNone: () => outgoing,
              onSome: (json) => HttpClientRequest.bodyJsonUnsafe(outgoing, json),
            }),
        ),
      ).pipe(Effect.mapError(() => userError(`Could not reach ${config.api_url}.`)));
      const text = yield* response.text.pipe(
        Effect.mapError(() => userError("Could not read the API response.")),
      );
      // JSON prints indented; anything else, such as a proxy's error page, as it came.
      const output = Option.match(decodeJson(text), {
        onNone: () => text,
        onSome: encodePrettyJson,
      });
      if (response.status >= 400) {
        return yield* Effect.fail(
          userError(`HTTP ${response.status}\n${output}`, {
            exitCode: exitCodeForStatus(response.status),
          }),
        );
      }
      if (output !== "") yield* Console.log(output);
    }),
).pipe(
  Command.withDescription(
    "Call an operation of the Voidhash API as yourself and print its JSON response.",
  ),
);

/** `voidhash-cli api …`: every operation of the Voidhash API, read from the server it talks to. */
export const apiCommand = Command.make("api", {}, () => Effect.void).pipe(
  Command.withDescription(
    "Find, describe and call any Voidhash API operation: everything the dashboard can do except paywall design.",
  ),
  Command.withSubcommands([apiListCommand, apiDescribeCommand, apiCallCommand]),
);
