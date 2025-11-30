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
    e.stopPropagation();
    dispatch('nodeMouseEnter', { id: nodeId });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dispatch('nodeMouseLeave', { id: nodeId });
  };

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: custom selectable element
    // biome-ignore lint/a11y/useSemanticElements: custom selectable element
    <div
      className="relative"
      onMouseDown={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
    >
      {children({ isSelected })}
    </div>
  );
}
