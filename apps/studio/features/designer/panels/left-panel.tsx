'use client';

import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Smartphone,
  Square,
  Type as TypeIcon
} from 'lucide-react';
import { useState } from 'react';
import { Example } from '../state/core/example';
import { PANEL_DIMENSIONS } from './constants';
import { Panel } from './core/components/panel';

const mockLayers = [
  {
    id: '1',
    name: 'Home Screen',
    type: 'screen' as const,
    expanded: true,
    children: [
      { id: '1-1', name: 'Header', type: 'frame' as const },
      { id: '1-2', name: 'Hero Text', type: 'text' as const },
      { id: '1-3', name: 'Background Image', type: 'image' as const }
    ]
  },
  {
    id: '2',
    name: 'Settings Screen',
    type: 'screen' as const,
    expanded: false,
    children: []
  }
];

const typeIcons = {
  screen: Smartphone,
  frame: Square,
  text: TypeIcon,
  image: ImageIcon
};

export function LeftPanel() {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
    new Set(['1'])
  );

  const toggleLayer = (id: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      className="fixed bottom-0 left-0 z-40 flex flex-col border-border border-r bg-sidebar backdrop-blur-xl"
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        width: PANEL_DIMENSIONS.LEFT_WIDTH
      }}
    >
      <Panel>
        <Example />
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-0.5">
            {mockLayers.map((layer) => {
              const Icon = typeIcons[layer.type];
              const isExpanded = expandedLayers.has(layer.id);

              return (
                <div key={layer.id}>
                  <button
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                    onClick={() => {
                      toggleLayer(layer.id);
                    }}
                    type="button"
                  >
                    {layer.children.length > 0 ? (
                      isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-white/40" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-white/40" />
                      )
                    ) : (
                      <span className="w-3" />
                    )}
                    <Icon className="h-3.5 w-3.5 text-violet-400" />
                    <span className="truncate text-white/80 text-xs">
                      {layer.name}
                    </span>
                  </button>

                  {isExpanded && layer.children.length > 0 && (
                    <div className="ml-4 space-y-0.5 border-white/[0.06] border-l pl-2">
                      {layer.children.map((child) => {
                        const ChildIcon = typeIcons[child.type];
                        return (
                          <button
                            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                            key={child.id}
                            type="button"
                          >
                            <ChildIcon className="h-3.5 w-3.5 text-white/40" />
                            <span className="truncate text-white/60 text-xs">
                              {child.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}
