/**
 * What commands ask of people: the things they name (by id, slug or name,
 * resolved here, with the candidates listed when that is ambiguous), the
 * values a command needs (prompted for on a terminal, a usage error off one),
 * and confirmation before a change that cannot be undone.
 *
 * Nothing here prompts unless both standard input and output are a terminal.
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stdio from "effect/Stdio";
import { Prompt } from "effect/cli";

import { ExitCode, userError } from "../utils/error-formatter";
import { printable } from "../utils/printable";

/** Whether the CLI can ask questions: standard input and output are both a terminal. */
export const isInteractive = Effect.fn("isInteractive")(function* () {
  const stdio = yield* Stdio.Stdio;
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal);
})();

/**
 * A kind of thing people name on the command line: what it answers to, and
 * how messages and prompts call it. An item always answers to its `id`.
 */
export interface ItemKind<A extends { readonly id: string }> {
  /** Singular and lowercase: `"product"`. */
  readonly noun: string;
  /** Plural, when it is not the noun with an `s`. */
  readonly plural?: string;
  /** How an item reads in a list or a prompt: `"Pro Monthly (pro-monthly)"`. */
  readonly label: (item: A) => string;
  /** The command that lists every item: `"voidhash-cli product list"`. */
  readonly listCommand: string;
  /** The command that creates one, offered when there is none yet. */
  readonly createCommand?: string;
  /** What an item answers to exactly besides its id: its slug, key or email. */
  readonly keys: (item: A) => ReadonlyArray<string>;
  /** What it also answers to, ignoring case: its name. */
  readonly names: (item: A) => ReadonlyArray<string>;
}

const pluralOf = <A extends { readonly id: string }>(kind: ItemKind<A>) =>
  kind.plural ?? `${kind.noun}s`;

/**
 * The items `input` names: those whose id or one of whose keys is exactly
 * `input`; when there are none, those with a key or name that is `input`
 * ignoring case. Several items can share a name, so this may return more
 * than one.
 */
export const itemsNamedBy = <A extends { readonly id: string }>(
  kind: ItemKind<A>,
  items: ReadonlyArray<A>,
  input: string,
): ReadonlyArray<A> => {
  const wanted = input.trim();
  const exact = Arr.filter(items, (item) => item.id === wanted || kind.keys(item).includes(wanted));
  if (Arr.isReadonlyArrayNonEmpty(exact)) return exact;
  const lower = wanted.toLowerCase();
  return Arr.filter(items, (item) =>
    [...kind.keys(item), ...kind.names(item)].some((key) => key.toLowerCase() === lower),
  );
};

/** Items with a key or name that contains `input`, as "did you mean" suggestions. */
const suggestionsFor = <A extends { readonly id: string }>(
  kind: ItemKind<A>,
  items: ReadonlyArray<A>,
  input: string,
) => {
  const lower = input.trim().toLowerCase();
  return Arr.filter(items, (item) =>
    [...kind.keys(item), ...kind.names(item)].some((key) => key.toLowerCase().includes(lower)),
  ).slice(0, 5);
};

/**
 * The one item of `items` that `input` names (see {@link itemsNamedBy}).
 * Fails with what to type instead: the closest items when none matches (exit
 * 4), every candidate with its id when several do (exit 2).
 */
export const findItem = <A extends { readonly id: string }>(
  kind: ItemKind<A>,
  items: ReadonlyArray<A>,
  input: string,
): Effect.Effect<A, ReturnType<typeof userError>> => {
  const named = itemsNamedBy(kind, items, input);
  const [only, ...others] = named;
  if (only !== undefined && Arr.isReadonlyArrayEmpty(others)) return Effect.succeed(only);
  if (Arr.isReadonlyArrayNonEmpty(named)) {
    return Effect.fail(
      userError(
        [
          `"${input}" matches ${named.length} ${pluralOf(kind)}:`,
          ...named.map((item) => `  ${kind.label(item)}  ${item.id}`),
        ].join("\n"),
        { hint: "Name it by its slug or id.", exitCode: ExitCode.usage },
      ),
    );
  }
  const suggestions = suggestionsFor(kind, items, input);
  return Effect.fail(
    userError(
      [
        `No ${kind.noun} matches "${input}".`,
        ...(Arr.isReadonlyArrayNonEmpty(suggestions)
          ? [`Did you mean ${suggestions.map(kind.label).join(", ")}?`]
          : []),
      ].join("\n"),
      {
        hint:
          Arr.isReadonlyArrayEmpty(items) && kind.createCommand !== undefined
            ? `There are no ${pluralOf(kind)} yet. Create one with '${kind.createCommand}'.`
            : `'${kind.listCommand}' lists them.`,
        exitCode: ExitCode.notFound,
      },
    ),
  );
};

/** The failure of a command that needs `what` and cannot ask for it: `usage` shows how to pass it. */
export const missingInput = (what: string, usage: string) =>
  userError(`Missing ${what}.`, {
    hint: `There is no terminal to ask in; run it as: ${usage}`,
    exitCode: ExitCode.usage,
  });

/** Asks which of `items` to use, in a terminal. Fails when there are none. */
export const chooseItem = <A extends { readonly id: string }>(
  kind: ItemKind<A>,
  items: ReadonlyArray<A>,
  message = `Which ${kind.noun}?`,
) =>
  Arr.isReadonlyArrayEmpty(items)
    ? Effect.fail(
        userError(`There are no ${pluralOf(kind)} yet.`, {
          hint:
            kind.createCommand === undefined
              ? undefined
              : `Create one with '${kind.createCommand}'.`,
          exitCode: ExitCode.notFound,
        }),
      )
    : Prompt.run(
        Prompt.Select({
          message,
          choices: items.map((item) => ({ title: printable(kind.label(item)), value: item })),
        }),
      );

/**
 * The item a command's argument names. When the argument is missing, asks
 * for it on a terminal and fails with `usage` (how to pass it) off one.
 *
 * @example
 * ```ts
 * const product = yield* requireItem(productKind, products, productArgument, "voidhash-cli product view <product>");
 * ```
 */
export const requireItem = <A extends { readonly id: string }>(
  kind: ItemKind<A>,
  items: ReadonlyArray<A>,
  input: Option.Option<string>,
  usage: string,
) =>
  Option.match(input, {
    onSome: (value) => findItem(kind, items, value),
    onNone: () =>
      Effect.gen(function* () {
        if (!(yield* isInteractive))
          return yield* Effect.fail(missingInput(`the ${kind.noun}`, usage));
        return yield* chooseItem(kind, items);
      }),
  });

/**
 * A text value a command needs: the flag's `value`, else what the person
 * types at a terminal (`initial` prefilled), else a usage failure.
 */
export const requireText = (
  value: Option.Option<string>,
  options: {
    readonly flag: string;
    readonly message: string;
    readonly usage: string;
    readonly initial?: string;
  },
) =>
  Option.match(value, {
    onSome: Effect.succeed,
    onNone: () =>
      Effect.gen(function* () {
        if (!(yield* isInteractive))
          return yield* Effect.fail(missingInput(options.flag, options.usage));
        return yield* Prompt.run(
          Prompt.String({
            message: options.message,
            // The prompt reads an absent default as "", not undefined.
            ...(options.initial === undefined ? {} : { default: options.initial }),
            validate: (text) =>
              text.trim() === "" ? Effect.fail("Type a value.") : Effect.succeed(text.trim()),
          }),
        );
      }),
  });

/** A choice a command needs: the flag's `value`, else a pick at a terminal, else a usage failure. */
export const requireChoice = <A>(
  value: Option.Option<A>,
  options: {
    readonly flag: string;
    readonly message: string;
    readonly usage: string;
    readonly choices: ReadonlyArray<{ readonly title: string; readonly value: A }>;
  },
) =>
  Option.match(value, {
    onSome: Effect.succeed,
    onNone: () =>
      Effect.gen(function* () {
        if (!(yield* isInteractive))
          return yield* Effect.fail(missingInput(options.flag, options.usage));
        return yield* Prompt.run(
          Prompt.Select({
            message: printable(options.message),
            choices: options.choices.map((choice) => ({
              ...choice,
              title: printable(choice.title),
            })),
          }),
        );
      }),
  });

/** The failure of a confirmation the person declined. */
const declined = () => userError("Nothing changed.");

/** The failure of a confirmation the CLI cannot ask for: the question, and how to answer it. */
const cannotConfirm = (question: string) =>
  userError(question, {
    hint: "There is no terminal to ask in; pass --yes to confirm.",
    exitCode: ExitCode.usage,
  });

/**
 * Asks before a change that cannot be undone. `message` is the question and
 * names what changes and where: `Delete product Pro (pro) from acme/app?`.
 * Continues when `yes` (`--yes`) or the person agrees; fails otherwise,
 * without asking when there is no terminal.
 */
export const confirmChange = (options: { readonly yes: boolean; readonly message: string }) =>
  Effect.gen(function* () {
    if (options.yes) return;
    if (!(yield* isInteractive)) return yield* Effect.fail(cannotConfirm(options.message));
    const agreed = yield* Prompt.run(
      Prompt.Confirm({ message: printable(options.message), initial: false }),
    );
    if (!agreed) return yield* Effect.fail(declined());
  });

/**
 * Asks the person to type `name` before a change with a wide reach, such as
 * deleting a project or an organization. `--yes` (`yes`) skips it.
 */
export const confirmByTypingName = (options: {
  readonly yes: boolean;
  readonly message: string;
  readonly name: string;
}) =>
  Effect.gen(function* () {
    if (options.yes) return;
    if (!(yield* isInteractive)) return yield* Effect.fail(cannotConfirm(options.message));
    // An end user can choose the name, so it must not reach the terminal raw,
    // even in the failure message. What's compared is what the person can see:
    // characters nothing shows can't be typed, and a keyboard's may be composed
    // differently.
    const name = printable(options.name).trim();
    const typeable = (text: string) =>
      printable(text)
        .replace(/\p{Cf}/gu, "")
        .normalize("NFC")
        .trim();
    // Nothing to type, and pressing Enter must not confirm.
    if (typeable(options.name) === "") {
      return yield* Effect.fail(
        userError(printable(options.message), {
          hint: "Its name has nothing to type; pass --yes to confirm.",
          exitCode: ExitCode.usage,
        }),
      );
    }
    yield* Prompt.run(
      Prompt.String({
        message: `${printable(options.message)} Type ${name} to confirm`,
        validate: (typed) =>
          typeable(typed) === typeable(options.name)
            ? Effect.succeed(typed)
            : Effect.fail(`Type ${name} exactly, or press Ctrl+C to stop.`),
      }),
    );
  });
