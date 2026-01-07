import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";

import {
  nodeClicked,
  nodeMouseEnter,
  nodeMouseLeave,
  nodeMouseOver,
} from "../../state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "../../state/designer-store";

export interface SelectableProps {
  children: ({
    isSelected,
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    onMouseOver,
    role,
  }: {
    isSelected: boolean;
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseOver: (e: React.MouseEvent<HTMLDivElement>) => void;
    role: string;
  }) => React.ReactNode;
  nodeId: string;
}

export function Selectable({ children, nodeId }: SelectableProps) {
  const store = usePaywallDesignerStore();
  const isSelected = useStore(
    store,
    useShallow((state) =>
      (state.mimic.presence.self?.selectedNodeIds ?? []).includes(nodeId)
    )
  );
  const dispatch = usePaywallDesignerActions();
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dispatch(nodeClicked)({ id: nodeId, shiftKey: e.shiftKey });
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const result = dispatch(nodeMouseEnter)({ id: nodeId }) as
      | { shouldPropagate?: boolean }
      | undefined;
    if (!result?.shouldPropagate) {
      e.stopPropagation();
    }
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const result = dispatch(nodeMouseOver)({ id: nodeId }) as
      | { shouldPropagate?: boolean }
      | undefined;
    if (!result?.shouldPropagate) {
      e.stopPropagation();
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dispatch(nodeMouseLeave)({ id: nodeId });
  };

  return (
    <>
      {children({
        isSelected,
        onMouseDown: handleClick,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onMouseOver: handleMouseOver,
        role: "button",
      })}
    </>
  );
}
