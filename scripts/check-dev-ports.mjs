// oxlint-disable effect/noAsyncFunction, effect/noGlobals, effect/noNewPromise, effect/noNodeBuiltinImport -- This pre-runtime bootstrap must probe OS sockets before Turbo starts the Effect applications.
import { createConnection } from "node:net";

const devServers = [
  { name: "Dashboard and docs", port: 3000 },
  { name: "Mimic example API", port: 3001 },
  { name: "Mimic admin", port: 3003 },
  { name: "Email previews", port: 3010 },
  { name: "Studio", port: 4830 },
  { name: "Mimic database", port: 5001 },
  { name: "Mimic example", port: 5173 },
];

const probe = (port, host) =>
  new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", (error) => {
      if (
        error.code === "ECONNREFUSED" ||
        error.code === "EHOSTUNREACH" ||
        error.code === "ENETUNREACH"
      ) {
        resolve(true);
        return;
      }
      if (error.code === "EADDRNOTAVAIL" || error.code === "EAFNOSUPPORT") {
        resolve(true);
        return;
      }
      reject(error);
    });
  });

const availability = await Promise.all(
  devServers.map(async (server) => ({
    ...server,
    available: (
      await Promise.all([probe(server.port, "127.0.0.1"), probe(server.port, "::1")])
    ).every(Boolean),
  })),
);

const unavailable = availability.filter(({ available }) => !available);
if (unavailable.length > 0) {
  for (const { name, port } of unavailable) {
    console.error(`${name} cannot start: port ${port} is already in use.`);
  }
  console.error(
    "\nStop the existing dev stack with Ctrl+C. Crashed Portless sessions are pruned automatically before this check.",
  );
  process.exitCode = 1;
}
