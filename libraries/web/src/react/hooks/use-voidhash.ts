import * as Option from "effect/Option";
import React from "react";

import { VoidhashError } from "../../errors";
import { VoidhashReactContext } from "../provider";

export const useVoidhash = () => {
  const context = React.useContext(VoidhashReactContext);
  if (Option.isNone(context)) {
    throw new VoidhashError("useVoidhash must be used within a VoidhashProvider.");
  }

  return context.value;
};
