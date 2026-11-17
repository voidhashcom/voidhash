/** The project a `voidhash.config.ts` names. */
export interface Config {
  team: string;
  project: string;
  /**
   * Output path for the generated `.d.ts` declaration file. Defaults to
   * `voidhash.gen.d.ts` at the project root.
   */
  typesOutput?: string;
}

/**
 * Returns the config it is given, typed.
 *
 * @deprecated Name the project in `voidhash.json` instead, which needs no
 * JavaScript package: `{ "team": "acme", "project": "app" }`. The CLI still
 * reads a `voidhash.config.ts` that passes an object literal to `defineConfig`.
 */
export declare const defineConfig: (config: Config) => Config;
