import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  basePath: "/docs",
  reactStrictMode: true,
  serverExternalPackages: [
    "ts-morph",
    "typescript",
    "oxc-transform",
    "@shikijs/twoslash",
  ],
};

export default withMDX(config);
