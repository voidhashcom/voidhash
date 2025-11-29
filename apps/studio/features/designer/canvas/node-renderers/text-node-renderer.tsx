import { extend } from '@pixi/react';
import { Input } from '@pixi/ui';
import { HTMLText } from 'pixi.js';
import type { TextNodeData } from '../../state/schema';
import { Selectable } from '../helpers/selectable';

extend({ Input, HTMLText });

export function TextNodeRenderer({ node }: { node: TextNodeData }) {
  return (
    <pixiContainer>
      <Selectable nodeId={node.id}>
        {() => (
          <pixiHTMLText
            style={{
              fontFamily: '"Source Sans Pro", Helvetica, sans-serif',
              fontSize: 15,
              fontWeight: '400',
              fill: 0x00_00_00
              // wordWrap: true
            }}
            text={node.text}
          />
        )}
      </Selectable>
    </pixiContainer>
  );
}
