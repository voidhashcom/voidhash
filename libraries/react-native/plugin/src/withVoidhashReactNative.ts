import type { ConfigPlugin } from "expo/config-plugins";
import { createRunOncePlugin } from "expo/config-plugins";

import pkg from "../../package.json";

const withVoidhashReactNative: ConfigPlugin<void> = (config) => config;

export default createRunOncePlugin(withVoidhashReactNative, pkg.name, pkg.version);
