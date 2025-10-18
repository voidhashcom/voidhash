import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { Layer } from 'effect';
import { AppLive } from './app';

// Specify the port
const port = 5001;

AppLive.pipe(
  Layer.provide(
    BunHttpServer.layer({
      port
    })
  ),
  Layer.launch,
  BunRuntime.runMain
);
