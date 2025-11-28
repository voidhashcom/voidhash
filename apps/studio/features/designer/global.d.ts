/** biome-ignore-all lint/style/noNamespace: <explanation> */

import type { PixiReactElementProps } from '@pixi/react';
import type { Application } from 'pixi.js';
import type { PropsWithChildren } from 'react';

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends PixiElements {
        pixiViewportWrapper: PropsWithChildren<
          PixiReactElementProps<ViewportWrapper>
        > & {
          app: Application;
        };
      }
    }
  }
}
