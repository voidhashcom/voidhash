import * as path from "node:path";

export const PACKAGE_ROOT = path.resolve(
  import.meta.dirname,
  path.basename(import.meta.dirname) === "dist" ? ".." : "../..",
);
