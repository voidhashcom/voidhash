interface Config {
  team: string;
  project: string;
  /**
   * Output path for the generated `.d.ts` declaration file. Defaults to
   * `voidhash.gen.d.ts` at the project root.
   */
  typesOutput?: string;
}

export const defineConfig = (config: Config) => config;
