/// <reference types="vite-plus/client" />

declare module "*.css?url" {
  const url: string;
  export default url;
}
