import { DevTools } from '@effect/experimental';
import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { Layer } from 'effect';
import { AppLive } from './app';

// Specify the port
const port = 5001;

console.log(process.env);

AppLive.pipe(
  Layer.provide(DevTools.layer()),
  Layer.provide(
    BunHttpServer.layer({
      port
    })
  ),
  Layer.launch,
  BunRuntime.runMain
);
