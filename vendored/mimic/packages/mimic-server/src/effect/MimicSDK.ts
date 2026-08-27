import { Effect, Layer, ManagedRuntime } from "effect";
import { RpcClient, type RpcClientError, type RpcGroup } from "effect/unstable/rpc";
import {
  type DatabasePermission,
  type DocumentAuthenticationSetup,
  type Grant,
  MimicRpcGroup,
  type User,
} from "../rpc/index.ts";

/**
 * Convenience alias for the typed `RpcClient` over our shared group. The
 * error channel carries `RpcClientError` alongside each RPC's declared
 * failures, matching what `RpcClient.make` produces.
 */
export type MimicRpcClient = RpcClient.RpcClient<
  RpcGroup.Rpcs<typeof MimicRpcGroup>,
  RpcClientError.RpcClientError
>;

import { DatabaseHandle } from "./DatabaseHandle.ts";
import { makeMimicProtocolLayer, type MimicClientConfig } from "./RpcClient.ts";
import type { CreateUserResult, DatabaseInfo, DocumentSnapshot } from "./types.ts";

/**
 * Alternative constructor input: an already-built protocol layer, used by
 * {@link MimicSDK.fromProtocolLayer} to bypass HTTP transport construction.
 */
export interface MimicProtocolSource {
  readonly protocolLayer: Layer.Layer<RpcClient.Protocol>;
}

const resolveProtocolLayer = (
  config: MimicClientConfig | MimicProtocolSource,
): Layer.Layer<RpcClient.Protocol> => {
  if ("protocolLayer" in config) return config.protocolLayer;
  return makeMimicProtocolLayer(config);
};

/**
 * Public entry point for the typed Effect SDK.
 *
 * Each instance owns a `ManagedRuntime` over the protocol layer (see
 * `RpcClient.ts`). Methods return self-contained `Effect` values — the
 * runtime context (HttpClient, serialization, RpcClient.Protocol) is
 * provided internally so callers don't need to know about transport
 * primitives.
 *
 * The `runEffect` helper is the workhorse: it builds an `RpcClient` for
 * the shared `MimicRpcGroup`, hands it to the user-supplied function, and
 * provides the protocol layer + scope. Each call gets its own scope, but
 * the underlying HttpClient + serializer are shared via the runtime.
 *
 * Handles (`DatabaseHandle`, `CollectionHandle`, `RawCollectionHandle`)
 * carry a back-reference to this SDK so they can call `runEffect` to make
 * fluent multi-step operations runnable as a single self-contained Effect.
 */
export class MimicSDK {
  readonly runtime: ManagedRuntime.ManagedRuntime<RpcClient.Protocol, never>;
  private readonly protocolLayer: Layer.Layer<RpcClient.Protocol>;

  constructor(config: MimicClientConfig | MimicProtocolSource) {
    this.protocolLayer = resolveProtocolLayer(config);
    this.runtime = ManagedRuntime.make(this.protocolLayer);
  }

  /**
   * Test seam: construct an SDK from an arbitrary protocol layer. Handy
   * for hooking up an in-memory test client (e.g. via `RpcTest.makeClient`
   * piped through a `Protocol` adapter) without going through HTTP.
   *
   * Production code should use the `new MimicSDK(config)` constructor;
   * this factory exists to make handle behavior testable end-to-end.
   */
  static fromProtocolLayer(protocolLayer: Layer.Layer<RpcClient.Protocol>): MimicSDK {
    return new MimicSDK({ protocolLayer });
  }

  /**
   * Internal: build a fully self-contained Effect by handing an `RpcClient`
   * to `fn`, wrapping the result in `Effect.scoped` to clean up the
   * per-call scope, and providing this SDK's protocol layer.
   */
  runEffect<A, E>(fn: (client: MimicRpcClient) => Effect.Effect<A, E>): Effect.Effect<A, E> {
    return Effect.flatMap(RpcClient.make(MimicRpcGroup), fn).pipe(
      Effect.scoped,
      Effect.provide(this.protocolLayer),
    );
  }

  // ---------------------------------------------------------------------
  // Database resources
  // ---------------------------------------------------------------------

  createDatabase(options: { readonly name: string; readonly description?: string }) {
    return this.runEffect((client) =>
      Effect.map(
        client.CreateDatabase({
          name: options.name,
          description: options.description ?? "",
        }),
        (result) => new DatabaseHandle(result.id, result.name, result.description, this),
      ),
    );
  }

  listDatabases(): Effect.Effect<readonly DatabaseInfo[], unknown> {
    return this.runEffect((client) => client.ListDatabases());
  }

  deleteDatabase(id: string) {
    return this.runEffect((client) => client.DeleteDatabase({ databaseId: id }));
  }

  /**
   * Returns a typed handle for an existing database. No network round-trip.
   */
  database(id: string, name = "", description = ""): DatabaseHandle {
    return new DatabaseHandle(id, name, description, this);
  }

  // ---------------------------------------------------------------------
  // User management — used by admin app and superuser flows.
  // ---------------------------------------------------------------------

  listUsers(): Effect.Effect<readonly User[], unknown> {
    return this.runEffect((client) => client.ListUsers());
  }

  createUser(options: {
    readonly username: string;
    readonly password: string;
  }): Effect.Effect<CreateUserResult, unknown> {
    return this.runEffect((client) =>
      client.CreateUser({
        username: options.username,
        password: options.password,
      }),
    );
  }

  deleteUser(userId: string) {
    return this.runEffect((client) => client.DeleteUser({ userId }));
  }

  // ---------------------------------------------------------------------
  // Grants
  // ---------------------------------------------------------------------

  listGrants(userId?: string): Effect.Effect<readonly Grant[], unknown> {
    return this.runEffect((client) => client.ListGrants({ userId }));
  }

  grantPermission(payload: {
    readonly userId: string;
    readonly databaseId: string;
    readonly permission: DatabasePermission;
  }) {
    return this.runEffect((client) => client.GrantPermission(payload));
  }

  revokePermission(payload: { readonly userId: string; readonly databaseId: string }) {
    return this.runEffect((client) => client.RevokePermission(payload));
  }

  // ---------------------------------------------------------------------
  // Document authentication — top-level convenience for tools that don't
  // hold a CollectionHandle (e.g. admin) but need to mint document tokens.
  // ---------------------------------------------------------------------

  setupDocumentAuthentication(options: {
    readonly collectionId: string;
    readonly documentId: string;
    readonly permission: "read" | "write";
    readonly origins: readonly string[];
    readonly expiresInSeconds?: number;
  }): Effect.Effect<DocumentAuthenticationSetup, unknown> {
    return this.runEffect((client) =>
      client.SetupDocumentAuthentication({
        collectionId: options.collectionId,
        documentId: options.documentId,
        permission: options.permission,
        origins: options.origins,
        expiresInSeconds: options.expiresInSeconds,
      }),
    );
  }

  /** Dispose the underlying runtime — releases any held resources. */
  dispose() {
    return this.runtime.dispose();
  }
}

// Re-export so consumers can ergonomically construct snapshots for tests.
export type { DocumentSnapshot };
