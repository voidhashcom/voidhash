import React from "react";

import { VoidhashReactContext } from "../provider";

export const useVoidhash = () => {
  const context = React.useContext(VoidhashReactContext);
  if (!context) {
    throw new Error("useVoidhash must be used within a VoidhashProvider.");
  }

  return context;
};
