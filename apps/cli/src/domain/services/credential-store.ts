import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { Hex } from "effect/encoding";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
// oxlint-disable-next-line effect/use-temp-file-scoped -- reads only the name of the operating system, to pick its credential store; no temporary files are involved.
import { platform } from "node:os";

import { FailedToStoreCredentialError } from "../errors/auth";

/** Where a stored credential is kept. */
export type StoredCredentialSource = "keychain" | "secret-service" | "file";

/** The operating system's own credential store, when the CLI uses one. */
export type OsStoreKind = Exclude<StoredCredentialSource, "file">;

/** Under which name the CLI's credentials are kept in the operating system's store. */
const SERVICE = "voidhash";

/**
 * The operating system store the CLI keeps credentials in: the login keychain
 * on macOS, the Secret Service through `secret-tool` on Linux when it is
 * installed, and none elsewhere (the credentials file).
 */
export const chooseOsStore = (options: {
  readonly platform: string;
  readonly hasSecretTool: boolean;
}): Option.Option<OsStoreKind> => {
  if (options.platform === "darwin") return Option.some("keychain");
  if (options.platform === "linux" && options.hasSecretTool) return Option.some("secret-service");
  return Option.none();
};

/**
 * The credentials file: `%APPDATA%\voidhash\credentials.json` on Windows,
 * otherwise `$XDG_CONFIG_HOME/voidhash/credentials.json`, by default under
 * `~/.config`.
 */
export const credentialsFilePath = (
  path: Path.Path,
  options: {
    readonly platform: string;
    readonly home: string;
    readonly xdgConfigHome: Option.Option<string>;
    readonly appData: Option.Option<string>;
  },
) => {
  const configHome =
    options.platform === "win32"
      ? Option.getOrElse(options.appData, () => path.join(options.home, "AppData", "Roaming"))
      : Option.getOrElse(
          Option.filter(options.xdgConfigHome, (value) => path.isAbsolute(value)),
          () => path.join(options.home, ".config"),
        );
  return path.join(configHome, "voidhash", "credentials.json");
};

/** The credentials file's contents: API origin to token. */
const CredentialsFileJson = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

/**
 * An API origin as it may appear in a keychain account name: `http` or
 * `https`, then a hostname or a bracketed IPv6 address, and maybe a port.
 */
const isSafeOrigin = (origin: string) => /^https?:\/\/[a-z0-9.\-[\]:]+$/.test(origin);

interface ToolResult {
  readonly exitCode: number;
  readonly stdout: string;
}

/** One credential store backend, keyed by API origin. */
interface Backend {
  readonly get: (
    origin: string,
  ) => Effect.Effect<Option.Option<string>, FailedToStoreCredentialError>;
  readonly set: (
    origin: string,
    token: string,
  ) => Effect.Effect<void, FailedToStoreCredentialError>;
  readonly remove: (origin: string) => Effect.Effect<void, FailedToStoreCredentialError>;
}

const storeError = (message: string) => (cause: unknown) =>
  new FailedToStoreCredentialError({ cause, message });

const makeOsBackend = Effect.fn("makeOsBackend")(function* (kind: OsStoreKind) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  /** Runs a credential tool, writing `input` to its standard input, and reads its output. */
  const runTool = (command: string, args: ReadonlyArray<string>, input = "") =>
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, [...args], {
          stdin: Stream.encodeText(Stream.make(input)),
        }),
      );
      const [stdout, exitCode] = yield* Effect.all(
        [
          Stream.mkString(Stream.decodeText(Stream.drainFork(handle.stdout, handle.stderr))),
          handle.exitCode,
        ],
        { concurrency: "unbounded" },
      );
      return { exitCode: Number(exitCode), stdout } satisfies ToolResult;
    }).pipe(
      Effect.scoped,
      // A keychain that waits for a password nobody can type (no login keychain
      // for this HOME, say) falls back to the file instead of hanging the CLI.
      Effect.timeout("30 seconds"),
      Effect.mapError(storeError(`Could not run ${command}`)),
    );

  const checkOrigin = (origin: string) =>
    isSafeOrigin(origin)
      ? Effect.void
      : Effect.fail(
          new FailedToStoreCredentialError({ message: `Unexpected API origin ${origin}` }),
        );

  if (kind === "keychain") {
    // `security` reports a missing item with exit code 44.
    const notFound = 44;
    return {
      get: (origin) =>
        checkOrigin(origin).pipe(
          Effect.andThen(
            runTool("security", ["find-generic-password", "-s", SERVICE, "-a", origin, "-w"]),
          ),
          Effect.flatMap(({ exitCode, stdout }) =>
            exitCode === 0
              ? Effect.succeed(
                  Option.some(stdout.trim()).pipe(Option.filter((token) => token !== "")),
                )
              : exitCode === notFound
                ? Effect.succeedNone
                : Effect.fail(
                    new FailedToStoreCredentialError({
                      message: `The keychain could not be read (security exited with ${exitCode})`,
                    }),
                  ),
          ),
        ),
      // `security add-generic-password -w <token>` would put the token on a command
      // line other users can read, and it cannot read a password from standard
      // input. Its interactive mode reads the command itself from standard input,
      // so the token, written as hexadecimal with -X, never appears in argv.
      set: (origin, token) =>
        checkOrigin(origin).pipe(
          Effect.andThen(
            runTool(
              "security",
              ["-i"],
              `add-generic-password -U -s ${SERVICE} -a "${origin}" -l "Voidhash CLI" -X ${Hex.encode(token)}\n`,
            ),
          ),
          Effect.flatMap(({ exitCode }) =>
            exitCode === 0
              ? Effect.void
              : Effect.fail(
                  new FailedToStoreCredentialError({
                    message: `The keychain could not be written (security exited with ${exitCode})`,
                  }),
                ),
          ),
        ),
      remove: (origin) =>
        checkOrigin(origin).pipe(
          Effect.andThen(
            runTool("security", ["delete-generic-password", "-s", SERVICE, "-a", origin]),
          ),
          Effect.flatMap(({ exitCode }) =>
            exitCode === 0 || exitCode === notFound
              ? Effect.void
              : Effect.fail(
                  new FailedToStoreCredentialError({
                    message: `The keychain item could not be deleted (security exited with ${exitCode})`,
                  }),
                ),
          ),
        ),
    } satisfies Backend;
  }

  // `secret-tool lookup` exits with 1 both for a missing item and when no Secret
  // Service is running (a headless session); either way the file is checked next.
  return {
    get: (origin) =>
      runTool("secret-tool", ["lookup", "service", SERVICE, "account", origin]).pipe(
        Effect.map(({ exitCode, stdout }) =>
          exitCode === 0
            ? Option.some(stdout.trim()).pipe(Option.filter((token) => token !== ""))
            : Option.none(),
        ),
      ),
    // `secret-tool store` reads the secret from standard input.
    set: (origin, token) =>
      runTool(
        "secret-tool",
        ["store", `--label=Voidhash CLI (${origin})`, "service", SERVICE, "account", origin],
        token,
      ).pipe(
        Effect.flatMap(({ exitCode }) =>
          exitCode === 0
            ? Effect.void
            : Effect.fail(
                new FailedToStoreCredentialError({
                  message: `The Secret Service could not be written (secret-tool exited with ${exitCode})`,
                }),
              ),
        ),
      ),
    // `secret-tool clear` exits with 0 when no item matched, too.
    remove: (origin) =>
      runTool("secret-tool", ["clear", "service", SERVICE, "account", origin]).pipe(
        Effect.flatMap(({ exitCode }) =>
          exitCode === 0
            ? Effect.void
            : Effect.fail(
                new FailedToStoreCredentialError({
                  message: `The Secret Service item could not be deleted (secret-tool exited with ${exitCode})`,
                }),
              ),
        ),
      ),
  } satisfies Backend;
});

const makeFileBackend = Effect.fn("makeFileBackend")(function* (filePath: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const warned = yield* Ref.make(false);

  /**
   * The tokens in the file. A file that cannot be read or is not a credentials
   * file counts as empty, so `login` can replace it and `logout` still runs;
   * the person is told once per run.
   */
  const read = Effect.gen(function* () {
    if (!(yield* fileSystem.exists(filePath))) return R.empty<string, string>();
    return yield* Schema.decodeUnknownEffect(CredentialsFileJson)(
      yield* fileSystem.readFileString(filePath),
    );
  }).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        if (!(yield* Ref.getAndSet(warned, true))) {
          const reason = error.message.split("\n")[0] ?? "";
          yield* Console.error(
            `! Could not read ${filePath} (${reason}), so the tokens in it are ignored. Delete the file, then sign in again with 'voidhash-cli login'.`,
          );
        }
        return R.empty<string, string>();
      }),
    ),
  );

  /**
   * Writes the credentials, readable by this user only: the directory 0700 and
   * the file 0600. They go to a new file beside it first, which then replaces
   * it, so an interrupted write leaves the previous file whole.
   */
  const write = (credentials: Record<string, string>) =>
    Effect.gen(function* () {
      const directory = path.dirname(filePath);
      yield* fileSystem.makeDirectory(directory, { recursive: true, mode: 0o700 });
      yield* fileSystem.chmod(directory, 0o700);
      const json = yield* Schema.encodeEffect(CredentialsFileJson)(credentials);
      const temporary = `${filePath}.${yield* Random.nextIntBetween(0, 2 ** 31)}.tmp`;
      yield* fileSystem.writeFileString(temporary, json, { flag: "wx", mode: 0o600 }).pipe(
        Effect.andThen(fileSystem.rename(temporary, filePath)),
        Effect.onError(() => fileSystem.remove(temporary).pipe(Effect.ignore)),
      );
    }).pipe(Effect.mapError(storeError(`Could not write ${filePath}`)));

  return {
    get: (origin) => read.pipe(Effect.map((credentials) => R.get(credentials, origin))),
    set: (origin, token) =>
      read.pipe(Effect.flatMap((credentials) => write({ ...credentials, [origin]: token }))),
    remove: (origin) =>
      read.pipe(
        Effect.flatMap((credentials) =>
          R.has(credentials, origin) ? write(R.remove(credentials, origin)) : Effect.void,
        ),
      ),
  } satisfies Backend;
});

/** A credential found in the store, and where. */
export interface StoredCredential {
  readonly token: string;
  readonly source: StoredCredentialSource;
}

/**
 * The store of the tokens the CLI signs in with, keyed by API origin. It keeps
 * them in the operating system's store when there is one, and falls back to
 * the credentials file when there is none or it cannot be written.
 */
export const makeCredentialStore = Effect.fn("makeCredentialStore")(function* (options: {
  readonly osStore: Option.Option<OsStoreKind>;
  readonly filePath: string;
}) {
  const file = yield* makeFileBackend(options.filePath);
  const os = Option.isSome(options.osStore)
    ? Option.some({
        kind: options.osStore.value,
        backend: yield* makeOsBackend(options.osStore.value),
      })
    : Option.none();

  /**
   * The token stored for `origin`: the file first, then the operating system's
   * store. The file holds a token only while the last save could not use the
   * operating system's store, as over SSH with the keychain locked, so it is
   * newer than one left there. Fails when the file holds no token and the
   * operating system's store could not be read, since one may be stored there.
   */
  const get = Effect.fn("CredentialStore.get")(function* (origin: string) {
    const fromFile = yield* file.get(origin);
    if (Option.isSome(fromFile)) {
      return Option.some<StoredCredential>({ token: fromFile.value, source: "file" });
    }
    if (Option.isNone(os)) return Option.none<StoredCredential>();
    return Option.map(yield* os.value.backend.get(origin), (token): StoredCredential => ({
      token,
      source: os.value.kind,
    }));
  });

  /** Stores `token` for `origin`, and answers where it went. */
  const set = Effect.fn("CredentialStore.set")(function* (origin: string, token: string) {
    if (Option.isSome(os)) {
      const stored = yield* os.value.backend.set(origin, token).pipe(
        Effect.as(true),
        Effect.catch((error) =>
          Effect.logDebug(`Credential store failed: ${error.message}`).pipe(Effect.as(false)),
        ),
      );
      if (stored) {
        // A token left in the file from an earlier fallback would be read
        // before this one, so the save fails unless it is gone.
        yield* file.remove(origin);
        return os.value.kind;
      }
    }
    yield* file.set(origin, token);
    return "file" as const;
  });

  /**
   * Deletes the token stored for `origin` from `source`, where it was found,
   * and any copy elsewhere. Fails when it could not be deleted from `source`.
   */
  const remove = Effect.fn("CredentialStore.remove")(function* (
    origin: string,
    source: StoredCredentialSource,
  ) {
    if (Option.isSome(os)) {
      const removed = os.value.backend.remove(origin);
      // Where no token was found, the operating system's store may not run at
      // all, as in a headless session.
      yield* source === os.value.kind
        ? removed
        : removed.pipe(
            Effect.catch((error) => Effect.logDebug(`Credential removal failed: ${error.message}`)),
          );
    }
    yield* file.remove(origin);
  });

  return { filePath: options.filePath, osStore: options.osStore, get, set, remove };
});

/** Whether an executable named `name` is in one of the `PATH` directories (Unix separators). */
const isOnPath = Effect.fn("isOnPath")(function* (name: string, pathVariable: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directories = pathVariable.split(":").filter((directory) => directory !== "");
  const found = yield* Effect.forEach(
    directories,
    (directory) =>
      fileSystem.exists(path.join(directory, name)).pipe(Effect.orElseSucceed(() => false)),
    { concurrency: "unbounded" },
  );
  return found.includes(true);
});

export class CredentialStore extends Context.Service<
  CredentialStore,
  Effect.Success<ReturnType<typeof makeCredentialStore>>
>()("voidhash-cli/CredentialStore") {
  /** The store for this computer: its operating system's store, or the credentials file. */
  static Default = Layer.effect(
    CredentialStore,
    Effect.fn("CredentialStore.Default")(function* () {
      const path = yield* Path.Path;
      const os = platform();
      const pathVariable = yield* Config.String("PATH").pipe(Config.withDefault(""));
      const filePath = credentialsFilePath(path, {
        platform: os,
        home: yield* Config.String("HOME").pipe(Effect.orDie),
        xdgConfigHome: yield* Config.option(Config.String("XDG_CONFIG_HOME")),
        appData: yield* Config.option(Config.String("APPDATA")),
      });
      const hasSecretTool = os === "linux" && (yield* isOnPath("secret-tool", pathVariable));
      return yield* makeCredentialStore({
        osStore: chooseOsStore({ platform: os, hasSecretTool }),
        filePath,
      });
    })().pipe(Effect.orDie),
  );

  /** A store that keeps credentials in the credentials file only, under `home`. */
  static fileOnly = (home: string) =>
    Layer.effect(
      CredentialStore,
      Effect.gen(function* () {
        const path = yield* Path.Path;
        return yield* makeCredentialStore({
          osStore: Option.none(),
          filePath: credentialsFilePath(path, {
            platform: "linux",
            home,
            xdgConfigHome: Option.none(),
            appData: Option.none(),
          }),
        });
      }),
    );
}
