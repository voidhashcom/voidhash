import { extend, useApplication } from '@pixi/react';
import type { Application } from 'pixi.js';
import { Viewport as BaseViewport, type IViewportOptions } from 'pixi-viewport';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState
} from 'react';
import { INIT_SCREEN_DATA } from '../constants';

type ViewportProps = Omit<IViewportOptions, 'events'>;

class ViewportWrapper extends BaseViewport {
  constructor(options: ViewportProps & { app: Application }) {
    const { app, ...rest } = options;
    super({
      ...rest,
      // events is the only required argument to the constructor.
      // This may be why extend() doesn't work propertly with pixi-viewport.
      // other pixi elements have no required arguments to the constructor.
      // hence we need to pass the app to the constructor.
      events: app.renderer.events
    });

    /// This centers the screen on the canvas
    this.moveCorner(
      -((this.screenWidth - INIT_SCREEN_DATA.width) / 2),
      -((this.screenHeight - INIT_SCREEN_DATA.height) / 2)
    );

    this.zoomPercent(-0.2, true);

    this.drag({
      pressDrag: false,
      factor: 30
    })
      .pinch({
        noDrag: true,
        factor: 30
      })
      .wheel({
        trackpadPinch: true,
        smooth: 3,
        percent: 2,
        wheelZoom: false
      })
      .decelerate({
        minSpeed: 0.1
      });
  }
}
extend({ ViewportWrapper });

const ViewportContext = createContext<ViewportWrapper | null>(null);
export function Viewport(props: PropsWithChildren<ViewportProps>) {
  const { children, ...rest } = props;

  const [viewport, setViewport] = useState<ViewportWrapper | null>(null);
  const { app } = useApplication();

  if (!app?.renderer) {
    return null;
  }

  return (
    <pixiViewportWrapper
      app={app}
      ref={(instance) => {
        setViewport(instance);
      }}
      {...rest}
    >
      {viewport && (
        <ViewportContext.Provider value={viewport}>
          {children}
        </ViewportContext.Provider>
      )}
    </pixiViewportWrapper>
  );
}

/**
 * Hook to get the viewport instance.
 * @returns The viewport instance.
 */
export function useViewport() {
  const context = useContext(ViewportContext);
  if (!context) {
    throw new Error('useViewport must be used within a ViewportProvider');
  }
  return context;
}
