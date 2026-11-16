import * as Effect from "effect/Effect";
import { ChildProcess } from "effect/process";
// oxlint-disable-next-line effect/use-temp-file-scoped -- reads only the name of the operating system, to pick its URL opener; no temporary files are involved.
import { platform } from "node:os";

/**
 * The command that opens `url` in the default browser on `os`. On Windows the
 * URL goes to the URL handler directly rather than through `cmd /c start`,
 * where `&` in a query would separate commands.
 */
export const opener = (url: string, os: string): readonly [string, ReadonlyArray<string>] => {
  if (os === "darwin") return ["open", [url]];
  if (os === "win32") return ["rundll32", ["url.dll,FileProtocolHandler", url]];
  return ["xdg-open", [url]];
};

/**
 * Best-effort: hand `url` to the person's default browser. The opener is
 * detached so it outlives the command, and never fails it.
 */
export const openInBrowser = (url: string) =>
  Effect.gen(function* openInBrowser() {
    const [command, args] = opener(url, platform());
    const child = yield* ChildProcess.make(command, [...args]);
    yield* child.unref;
  }).pipe(Effect.scoped, Effect.ignore);
