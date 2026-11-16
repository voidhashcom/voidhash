import { make as makeCoreClient, type PageInfo } from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import * as Option from "effect/Option";

import { CliConfig } from "../domain/services/cli-config";
import { type Credential, Credentials } from "../domain/services/credentials";

/** The `Authorization` header carrying the credential, empty when there is none for the host. */
const credentialHeaders = (credential: Option.Option<Credential>): Record<string, string> =>
  Option.match(credential, {
    onNone: () => ({}),
    onSome: ({ token }) => ({ authorization: `Bearer ${token}` }),
  });

const make = Effect.gen(function* effect() {
  yield* Effect.logDebug("Initializing API client");
  const cliConfig = yield* CliConfig;
  const credentials = yield* Credentials;
  const httpClient = yield* HttpClient.HttpClient;
  return makeCoreClient(httpClient, {
    transformClient: (client) =>
      Effect.succeed(
        client.pipe(
          HttpClient.mapRequestEffect((request) =>
            Effect.fn("transformClient")(function* transformClient() {
              const config = yield* cliConfig
                .readConfig()
                .pipe(Effect.catch(() => Effect.die("Failed to read config")));

              // Looked up for the host the request goes to, so a profile on another
              // host never sends this one's token.
              const credential = yield* credentials
                .resolve(config.api_url)
                .pipe(Effect.catch((error) => Effect.die(error.message)));

              yield* Effect.logDebug(`API Request: ${request.method} ${request.url}`);

              return HttpClientRequest.setHeaders(
                HttpClientRequest.prependUrl(request, config.api_url),
                credentialHeaders(credential),
              );
            })().pipe(Effect.withSpan("ApiClient.transformRequest")),
          ),
          // The token is read once per run, and another run may since have
          // signed in again, which ends its session. A refused request reads
          // the stored token again, and is sent once more when it changed.
          HttpClient.transform((response, request) =>
            Effect.flatMap(response, (answer) =>
              answer.status !== 401 || request.body._tag === "Stream"
                ? Effect.succeed(answer)
                : credentials.reload(request.url).pipe(
                    Effect.orElseSucceed(() => Option.none<Credential>()),
                    Effect.flatMap((credential) => {
                      const headers = credentialHeaders(credential);
                      return Option.isNone(credential) ||
                        headers.authorization === request.headers.authorization
                        ? Effect.succeed(answer)
                        : client.execute(HttpClientRequest.setHeaders(request, headers));
                    }),
                  ),
            ),
          ),
        ),
      ),
  });
}).pipe(Effect.withSpan("ApiClient.make"));

/** The generated Voidhash API client the CLI calls, with the credential for the API host. */
export type ApiClientShape = Effect.Success<typeof make>;

export class ApiClient extends Context.Service<ApiClient, ApiClientShape>()(
  "voidhash-cli/ApiClient",
) {
  /** Needs the {@link CliConfig}, {@link Credentials} and an `HttpClient`. */
  static layer = Layer.effect(ApiClient, make);

  /** {@link layer} sending its requests with `fetch`. */
  static Default = ApiClient.layer.pipe(Layer.provide(FetchHttpClient.layer));
}

/** The query of one page of a listing: up to 100 items after `cursor`. */
export interface PageQuery {
  readonly limit: number;
  readonly cursor?: string;
}

/**
 * Reads every page of a listing, following the cursors. `page` asks for one
 * page with `query`; spread it into the operation's options.
 *
 * @example
 * ```ts
 * const products = yield* readAll((query) => api.productsList(projectId, query));
 * const subscriptions = yield* readAll((query) => api.productsList(projectId, { ...query, type: "subscription" }));
 * ```
 */
export const readAll = <A, E, R>(
  page: (
    query: PageQuery,
  ) => Effect.Effect<{ readonly data: ReadonlyArray<A>; readonly pageInfo: PageInfo }, E, R>,
  query: PageQuery = { limit: 100 },
): Effect.Effect<ReadonlyArray<A>, E, R> =>
  Effect.flatMap(page(query), (current) =>
    current.pageInfo.hasNextPage && current.pageInfo.endCursor !== null
      ? Effect.map(
          readAll(page, { limit: query.limit, cursor: current.pageInfo.endCursor }),
          (rest) => [...current.data, ...rest],
        )
      : Effect.succeed(current.data),
  );
