import { createServer, type ViteDevServer } from "vite";

import { createStudioViteConfig } from "./config";

export { createStudioViteConfig, STUDIO_ROOT } from "./config";

export interface StartStudioOptions {
  /** The user's project root (folder containing `.voidhash`). */
  projectRoot: string;
  /** Preferred port; Vite picks the next free port if taken. Defaults to 4830. */
  port?: number;
}

export interface StudioHandle {
  /** The URL the Studio dev server is listening on. */
  readonly url: string;
  /** The resolved port. */
  readonly port: number;
  /** Stops the dev server. */
  readonly close: () => Promise<void>;
  /** The underlying Vite dev server, for advanced control. */
  readonly server: ViteDevServer;
}

const DEFAULT_PORT = 4830;

/**
 * Boots the Studio Vite dev server for a given project and returns a handle.
 * This is the programmatic entry point the CLI's `studio` command calls.
 */
export const startStudio = async ({
  projectRoot,
  port = DEFAULT_PORT,
}: StartStudioOptions): Promise<StudioHandle> => {
  const server = await createServer(
    createStudioViteConfig({ projectRoot, port }),
  );

  await server.listen();

  const resolvedPort = server.config.server.port ?? port;
  const url = `http://localhost:${resolvedPort}`;

  return {
    close: () => server.close(),
    port: resolvedPort,
    server,
    url,
  };
};
