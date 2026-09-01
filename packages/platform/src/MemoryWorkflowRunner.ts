import * as Layer from "effect/Layer";
import { WorkflowEngine } from "effect/unstable/workflow";

import * as EffectWorkflowRunner from "./EffectWorkflowRunner.ts";

/** In-process workflow runner backed by Effect's dependency-free memory engine. */
export const layer = EffectWorkflowRunner.layer.pipe(Layer.provide(WorkflowEngine.layerMemory));
