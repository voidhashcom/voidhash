// voidhash.gen.d.ts — placeholder for the file `voidhash-cli types generate`
// writes. Until you generate it against your own project, every slug argument
// (`"pro"`, `"onboarding"`, `"pro-monthly"`) is typed as `string`. After you
// generate it, the same call sites autocomplete your project's real slugs and
// reject typos at compile time.
//
// `flows` is written by hand here to show what generated declarations look
// like for a location whose flow has an interface: the inputs it takes, the
// outputs it reports, the outcomes it finishes with and the app actions it
// calls. `voidhash.flows.gen.ts` holds the matching interface revisions.

declare module "@voidhash/react-native" {
  interface VoidhashRegister {
    schema: {
      products: never;
      locations: never;
      perks: never;
    };
    flows: {
      onboarding: {
        // Inputs have defaults in the flow, so an app may leave any of them out.
        input: { firstName?: string; credits?: number };
        output: { goal: string; reminders: boolean };
        // `purchased`, `restored` and `dismissed` are added by the SDK.
        outcome: "completed" | "skipped";
        actions: {
          pickGoal: (args: { current: string }) => Promise<{ goal: string }> | { goal: string };
        };
      };
    };
  }
}

export {};
