// oxlint-disable effect/noGlobals -- This pre-runtime guard must validate the Node process before any Effect application starts.
const minimumNodeMajor = 24;
const currentNodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);

if (process.getuid?.() === 0) {
  console.error("Do not run `pnpm dev` with sudo.");
  console.error(
    "Portless elevates only its HTTPS proxy when necessary; the app processes must run as your normal user.",
  );
  console.error("Activate Node from .nvmrc with your version manager, then run `pnpm dev`.");
  process.exitCode = 1;
} else if (currentNodeMajor < minimumNodeMajor) {
  console.error(`Node.js ${minimumNodeMajor}+ is required; the current process is ${process.version}.`);
  console.error("Activate Node from .nvmrc with your version manager, then run `pnpm dev`.");
  process.exitCode = 1;
}
