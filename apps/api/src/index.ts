import { DevTools } from "@effect/experimental";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { AppLive } from "./app";

// Specify the port
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5001;

AppLive.pipe(
	Layer.provide(DevTools.layer()),
	Layer.provideMerge(
		BunHttpServer.layer({
			port,
		}),
	),
	// @ts-expect-error - Layer.launch is not typed correctly
	Layer.launch,
	BunRuntime.runMain,
);
