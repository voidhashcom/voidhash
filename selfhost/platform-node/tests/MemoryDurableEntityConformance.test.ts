import { durableEntityHostConformance } from "@voidhash/platform/conformance";

import { MemoryDurableEntityHostLive } from "../src/MemoryDurableEntity.ts";

// The shared suite is what keeps adapters interchangeable: the in-memory host
// and the cluster host answer to exactly the same assertions.
durableEntityHostConformance({
  name: "memory",
  layer: () => MemoryDurableEntityHostLive,
});
