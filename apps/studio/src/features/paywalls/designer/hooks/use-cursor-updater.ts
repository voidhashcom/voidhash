import { useEffect } from 'react';
import { useViewport } from '../canvas/viewport';
import { updateCursor } from '../state/actions';
import { usePaywallDesignerActions } from '../state/designer-store';

export function useCursorUpdater() {
  const dispatch = usePaywallDesignerActions();
  const { screenToCanvas } = useViewport();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      dispatch(updateCursor)(canvasPos);
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dispatch, screenToCanvas]);
}
