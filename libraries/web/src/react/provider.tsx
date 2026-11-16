import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import React, { createContext } from "react";

import {
  createVoidhashClient,
  type VoidhashClientOptions,
  type VoidhashWebClient,
} from "../client";
import { VoidhashError } from "../errors";

interface ProviderBaseProps {
  readonly children: React.ReactNode;
}

interface ProviderWithClient extends ProviderBaseProps {
  readonly client: VoidhashWebClient;
  readonly config?: never;
}

interface ProviderWithConfig extends ProviderBaseProps {
  readonly client?: never;
  readonly config: VoidhashClientOptions;
}

/** Where the provider's client is in its start-up. */
export type VoidhashProviderStatus = "initializing" | "ready" | "failed";

export interface VoidhashReactContextValue {
  readonly client: VoidhashWebClient;
  readonly distinctId?: string;
  /** Why `initialize()` failed. Set only while `status` is `failed`. */
  readonly initError?: Error;
  /** `true` once the client is ready; the same as `status === "ready"`. */
  readonly isInitialized: boolean;
  /** Initializes the client again after a failure; does nothing otherwise. */
  readonly retryInit: () => void;
  readonly status: VoidhashProviderStatus;
}

export const VoidhashReactContext = createContext<Option.Option<VoidhashReactContextValue>>(
  Option.none(),
);

const resolveClient = (
  props: ProviderWithClient | ProviderWithConfig,
): Option.Option<VoidhashWebClient> => {
  if ("client" in props && props.client) {
    return Option.some(props.client);
  }

  const { config } = props;
  if (!config) {
    return Option.none();
  }

  return Option.some(createVoidhashClient(config));
};

interface VoidhashProviderState {
  readonly distinctId?: string;
  readonly initError?: Error;
  readonly status: VoidhashProviderStatus;
}

const toError = (cause: unknown) => (P.isError(cause) ? cause : new VoidhashError(String(cause)));

/**
 * Provides a client to the hooks and initializes it on mount.
 *
 * With `config`, the provider creates the client and destroys it when it
 * unmounts; shown again after that, for example by a Suspense boundary or an
 * `<Activity>` that hid it, it starts a new one. With `client`, the caller
 * owns the client, and unmounting leaves it running, so a client shared with
 * code outside React keeps working. Both props are read once, on mount.
 */
export class VoidhashProvider extends React.Component<
  ProviderWithClient | ProviderWithConfig,
  VoidhashProviderState
> {
  private client: VoidhashWebClient;
  private readonly ownsClient: boolean;
  // Set once the deferred destroy ran, so a later mount starts a new client.
  private destroyedOwnClient = false;
  private pendingDestroy = Option.none<ReturnType<typeof setTimeout>>();
  private removeInitialized = () => {};
  private removeIdentityChanged = () => {};
  private isMounted = false;
  // The context value of the current state, so consumers re-render only when
  // the state changes, not every time the provider's parent renders.
  private contextValue = Option.none<{
    readonly client: VoidhashWebClient;
    readonly state: VoidhashProviderState;
    readonly value: Option.Option<VoidhashReactContextValue>;
  }>();

  constructor(props: ProviderWithClient | ProviderWithConfig) {
    super(props);
    const client = resolveClient(props);
    if (Option.isNone(client)) {
      throw new VoidhashError("VoidhashProvider failed to create a client instance.");
    }
    this.client = client.value;
    this.ownsClient = !props.client;
    this.state = { status: "initializing" };
  }

  private readonly retryInit = () => {
    if (this.state.status !== "failed") return;
    this.setState({ initError: undefined, status: "initializing" });
    this.startClient();
  };

  private startClient() {
    // The outcome belongs to this client; a provider that has started another
    // one since, after being hidden and shown again, ignores it.
    const client = this.client;
    const isCurrent = () => this.isMounted && this.client === client;
    client.initialize().then(
      () => {
        if (!isCurrent()) return;
        this.updateState({
          distinctId: client.peekDistinctId(),
          initError: undefined,
          status: "ready",
        });
      },
      (cause: unknown) => {
        if (!isCurrent()) return;
        this.setState({ initError: toError(cause), status: "failed" });
      },
    );
  }

  override componentDidMount(): void {
    // Strict Mode unmounts and remounts right away; the client survives that.
    Option.map(this.pendingDestroy, clearTimeout);
    this.pendingDestroy = Option.none();
    if (this.destroyedOwnClient) {
      const client = resolveClient(this.props);
      if (Option.isSome(client)) this.client = client.value;
      this.destroyedOwnClient = false;
      this.setState({ distinctId: undefined, initError: undefined, status: "initializing" });
    }
    this.isMounted = true;
    this.removeInitialized = this.client.on("initialized", ({ distinctId }) => {
      this.updateState({ distinctId, initError: undefined, status: "ready" });
    });
    this.removeIdentityChanged = this.client.on("identity-changed", ({ distinctId }) => {
      this.updateState({ distinctId });
    });
    this.startClient();
  }

  /** Sets state only when a value changes, so consumers do not re-render for nothing. */
  private updateState(next: Partial<VoidhashProviderState>) {
    const merged = { ...this.state, ...next };
    if (
      merged.distinctId === this.state.distinctId &&
      merged.initError === this.state.initError &&
      merged.status === this.state.status
    ) {
      return;
    }
    this.setState(merged);
  }

  override componentWillUnmount(): void {
    this.isMounted = false;
    this.removeInitialized();
    this.removeIdentityChanged();
    if (!this.ownsClient) {
      return;
    }
    // Deferred so a remount in the same commit, as Strict Mode does, can
    // cancel it.
    this.pendingDestroy = Option.some(
      setTimeout(() => {
        this.pendingDestroy = Option.none();
        this.destroyedOwnClient = true;
        void this.client.destroy();
      }, 0),
    );
  }

  private currentContextValue() {
    if (
      Option.isSome(this.contextValue) &&
      this.contextValue.value.state === this.state &&
      this.contextValue.value.client === this.client
    ) {
      return this.contextValue.value.value;
    }
    const client = this.client;
    const { distinctId, ...state } = this.state;
    const value = Option.some({
      client,
      ...state,
      // A getter, as reading it is the app being handed the id; see `getDistinctId`.
      get distinctId() {
        client.getDistinctId();
        return distinctId;
      },
      isInitialized: this.state.status === "ready",
      retryInit: this.retryInit,
    });
    this.contextValue = Option.some({ client: this.client, state: this.state, value });
    return value;
  }

  override render(): React.ReactNode {
    const value = this.currentContextValue();
    return (
      <VoidhashReactContext.Provider value={value}>
        {this.props.children}
      </VoidhashReactContext.Provider>
    );
  }
}
