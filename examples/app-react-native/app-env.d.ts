// Metro resolves image assets to a registered asset reference. Declaring the
// module lets asset files be pulled in with a static import instead of `require`.
declare module "*.png" {
  import type { ImageRequireSource } from "react-native";

  const source: ImageRequireSource;
  export default source;
}
