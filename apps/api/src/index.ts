import { HttpApiBuilder } from '@effect/platform';
import { Routes } from './app';

const { dispose, handler } = HttpApiBuilder.toWebHandler(Routes);

// When the process is interrupted, we want to clean up resources
process.on('SIGINT', () => {
  dispose().then(
    () => {
      process.exit(0);
    },
    () => {
      process.exit(1);
    }
  );
});

// Use the handler in your server setup
export { handler };
