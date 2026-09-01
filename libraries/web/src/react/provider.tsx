import * as Option from "effect/Option";
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

export interface VoidhashReactContextValue {
  readonly client: VoidhashWebClient;
  readonly distinctId?: string;
  readonly isInitialized: boolean;
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
  readonly isInitialized: boolean;
}

export class VoidhashProvider extends React.Component<
  ProviderWithClient | ProviderWithConfig,
  VoidhashProviderState
> {
  private readonly client: VoidhashWebClient;
  private removeInitialized = () => {};
  private removeIdentityChanged = () => {};

  constructor(props: ProviderWithClient | ProviderWithConfig) {
    super(props);
    const client = resolveClient(props);
    if (Option.isNone(client)) {
      throw new VoidhashError("VoidhashProvider failed to create a client instance.");
    }
    this.client = client.value;
    this.state = { isInitialized: false };
  }

  override componentDidMount(): void {
    this.removeInitialized = this.client.on("initialized", ({ distinctId }) => {
      this.setState({ distinctId, isInitialized: true });
    });
    this.removeIdentityChanged = this.client.on("identity-changed", ({ distinctId }) => {
      this.setState({ distinctId });
    });
    void this.client.initialize().then(() => {
      this.setState({
        distinctId: Option.getOrUndefined(this.client.getDistinctId()),
        isInitialized: true,
      });
    });
  }

  override componentWillUnmount(): void {
    this.removeInitialized();
    this.removeIdentityChanged();
    void this.client.destroy();
  }

  override render(): React.ReactNode {
    const value = Option.some({ client: this.client, ...this.state });
    return (
      <VoidhashReactContext.Provider value={value}>
        {this.props.children}
      </VoidhashReactContext.Provider>
    );
  }
}
