interface Config {
  schema: string;
  team: string;
  project: string;
}

export const defineConfig = (config: Config) => config;
