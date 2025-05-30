import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig } from "eslint/config";
// import neverthrowMustUse from "eslint-plugin-neverthrow-must-use"; // Import plugin
import tsPlugin from "@typescript-eslint/eslint-plugin"; // Import TypeScript plugin
import tsParser from "@typescript-eslint/parser"; // Import TypeScript parser

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: [
      "lib/**/*.ts",
      "lib/**/*.tsx",
      "app/**/*.ts",
      "app/**/*.tsx",
      "features/**/*.ts",
      "features/**/*.tsx",
      "jobs/**/*.ts",
      "jobs/**/*.tsx",
    ],
    languageOptions: {
      parser: tsParser, // Set TypeScript parser
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json", // Ensure ESLint reads tsconfig
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin, // Enable TypeScript ESLint rules
      // "neverthrow-must-use": neverthrowMustUse, // Register the plugin
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error", // Example TypeScript rule
      // "neverthrow-must-use/must-use-result": "error", // Enforce `neverthrow` rule
    },
  },
]);

export default eslintConfig;
