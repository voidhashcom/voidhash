import { Effect } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";

const mount = Effect.gen(function* () {
  const container = document.getElementById("root");
  if (!container) {
    return yield* Effect.die(new Error("Studio root element #root not found"));
  }

  yield* Effect.sync(() =>
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
});

Effect.runSync(mount);
