import { DocumentDefinition } from '../core';
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

  readonly rootNodeTypes = ['screen'] as const;

  // Example future migration
  // readonly migrations = {
  //   2: (data) => { /* transform v1 -> v2 */ return data; }
  // };
}

export const paywallDocument = new PaywallDocument();
