import { s } from '../schema';
import type { Infer } from '../schema';

/** RootNode schema - the document root that contains screens */
export const rootNode = s.object({
  type: s.literal('root'),
  id: s.string()
});

export type RootNodeData = Infer<typeof rootNode>;

/** Allowed child types for RootNode */
export const rootNodeAllowedChildren = ['screen'] as const;
