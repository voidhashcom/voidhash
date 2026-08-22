// voidhash.gen.d.ts — placeholder for the file `voidhash-cli types generate`
// writes. Until you generate it against your own project, every slug argument
// (`"pro"`, `"onboarding"`, `"pro-monthly"`) is typed as `string`. After you
// generate it, the same call sites autocomplete your project's real slugs and
// reject typos at compile time.

declare module "@voidhash/react-native" {
  interface VoidhashRegister {
    schema: {
      products: never;
      locations: never;
      perks: never;
    };
  }
}

export {};
