import type { Primitive } from '@voidhash/mimic';
import type { dnfSchema } from './states';

// Export DNF type for use in other files
export type DNF = Primitive.InferState<typeof dnfSchema>;
