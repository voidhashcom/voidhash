import { DocumentDefinition } from '../core';
import { migrateV2 } from '../migrations/v2';
import { FlexNode, RootNode, ScreenNode, TextNode } from '../nodes';

type PaywallNodeTypes = 'root' | 'screen' | 'flex' | 'text';

export class PaywallDocument extends DocumentDefinition<PaywallNodeTypes> {
  readonly type = 'paywall';
  readonly schemaVersion = 1;

  readonly nodeClasses = {
    root: new RootNode(),
    screen: new ScreenNode(),
    flex: new FlexNode(),
    text: new TextNode()
  };

  readonly rootNodeTypes = ['root'] as const;

  // Example future migration
  readonly migrations = {
    2: migrateV2
  };
}

export const paywallDocument = new PaywallDocument();
