import { DevTools } from "@effect/experimental";
import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { QueryClient } from "@tanstack/react-query";
import { RpcGroups } from "@voidhash/rpc";
import { Effect, Layer } from "effect";
import {
	createEffectQuery,
	type createEffectQueryFromManagedRuntime,
} from "effect-query";
import { env } from "./env";

const DevToolsLive = DevTools.layer();

export const RpcProtocolLive = RpcClient.layerProtocolHttp({
	url: `${env.VITE_APP_API_BASE_URL}/rpc`,
}).pipe(
	Layer.provide([
		// use fetch for http requests
		FetchHttpClient.layer.pipe(
			Layer.provide(
				Layer.succeed(FetchHttpClient.RequestInit, {
					credentials: "include",
				}),
			),
		),
		// use ndjson for serialization
		RpcSerialization.layerNdjson,
	]),
);

export class VoidhashRpc extends Effect.Service<VoidhashRpc>()(
	"voidhash/VoidhashRpc",
	{
		dependencies: [],
		scoped: RpcClient.make(RpcGroups),
	},
) {}

export const LiveLayer = VoidhashRpc.Default.pipe(
	Layer.provideMerge(Layer.mergeAll(RpcProtocolLive, DevToolsLive)),
);

export const queryClient = new QueryClient();
export const eq = createEffectQuery(LiveLayer);

export type EffectQueryType = ReturnType<
	typeof createEffectQueryFromManagedRuntime<typeof LiveLayer>
>;

export const exampleQuery = (effectQuery: EffectQueryType) =>
	effectQuery.queryOptions({
		queryKey: ["creative-metrics"],
		queryFn: () => Effect.succeed(true),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});
