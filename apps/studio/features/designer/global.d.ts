/** biome-ignore-all lint/style/noNamespace: <explanation> */

// import type { LayoutContainer } from '@pixi/layout/components';
import type { PixiReactElementProps } from '@pixi/react';
// import type { Input } from '@pixi/ui';
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
        // pixiContainer: PropsWithChildren<PixiReactElementProps<Container>>;
        // pixiInput: PropsWithChildren<PixiReactElementProps<Input>>;

        pixiLayoutContainer: PropsWithChildren<
          PixiReactElementProps<LayoutContainer>
        >;
        pixiHTMLText: typeof pixiHTMLText;
      }
    }
  }
}
