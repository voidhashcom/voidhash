import { useShallow } from 'zustand/react/shallow';
import {
  useDesignerActions,
  useDesignerSelect
} from '../../state/designer-store';

export type SelectableProps = {
  children: ({ isSelected }: { isSelected: boolean }) => React.ReactNode;
  nodeId: string;
};

export function Selectable({ children, nodeId }: SelectableProps) {
  const isSelected = useDesignerSelect(
    useShallow((state) => state.selectedNodeIds.includes(nodeId))
  );
  const dispatch = useDesignerActions();
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dispatch('nodeClicked', { id: nodeId, shiftKey: e.shiftKey });
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const result = dispatch('nodeMouseEnter', { id: nodeId });
    if (!result?.shouldPropagate) {
      e.stopPropagation();
    }
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const result = dispatch('nodeMouseOver', { id: nodeId });
    if (!result?.shouldPropagate) {
      e.stopPropagation();
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dispatch('nodeMouseLeave', { id: nodeId });
  };

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: custom selectable element
    // biome-ignore lint/a11y/useSemanticElements: custom selectable element
    // biome-ignore lint/a11y/useKeyWithMouseEvents: highlighting
    <div
      className="relative"
      onMouseDown={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseOver={handleMouseOver}
      role="button"
    >
      {children({ isSelected })}
    </div>
  );
}
