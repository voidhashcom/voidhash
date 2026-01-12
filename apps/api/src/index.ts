import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";

import { AppLive } from "./app";
import { ObservabilityLive } from "./observability";

// Specify the port
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5001;

AppLive.pipe(
	Layer.provide(
		BunHttpServer.layer({
			port,
		}),
	),
	Layer.provide(ObservabilityLive),
	Layer.launch,
	BunRuntime.runMain,
);
