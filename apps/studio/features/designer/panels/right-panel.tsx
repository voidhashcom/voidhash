'use client';

import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical
} from 'lucide-react';
import { useState } from 'react';
import { PANEL_DIMENSIONS } from './constants';
import { Panel } from './core/components/panel';
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle
} from './core/components/panel-section';

function PropertySection({
  title,
  children,
  defaultOpen = true
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-border border-b">
      <button
        className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
        onClick={() => {
          setIsOpen((o) => !o);
        }}
        type="button"
      >
        <span className="font-medium text-[11px] text-white/70">{title}</span>
        <span className="text-[10px] text-white/40">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function InputField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-[10px] text-white/40">{label}</span>
      <input
        className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-white/80 text-xs outline-none transition-colors focus:border-violet-500/50 focus:bg-white/[0.04]"
        defaultValue={value}
        type="text"
      />
    </div>
  );
}

export function RightPanel() {
  return (
    <div
      className="fixed right-0 bottom-0 z-40 flex flex-col border-border border-l bg-sidebar"
      style={{
        top: PANEL_DIMENSIONS.TOP_HEIGHT,
        width: PANEL_DIMENSIONS.RIGHT_WIDTH
      }}
    >
      <Panel>
        <PanelSection>
          <PanelSectionHeader>
            <PanelSectionTitle>Alignment</PanelSectionTitle>
          </PanelSectionHeader>
          <PanelSectionContent>
            <div className="flex gap-2">
              <div className="flex rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5">
                <button
                  className="rounded p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  title="Align left"
                  type="button"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  title="Align center"
                  type="button"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  title="Align right"
                  type="button"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5">
                <button
                  className="rounded p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  title="Align top"
                  type="button"
                >
                  <AlignStartVertical className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  title="Align middle"
                  type="button"
                >
                  <AlignCenterVertical className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  title="Align bottom"
                  type="button"
                >
                  <AlignEndVertical className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </PanelSectionContent>
        </PanelSection>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Alignment */}

          {/* Position & Size */}
          <PropertySection title="Frame">
            <div className="grid grid-cols-2 gap-2">
              <InputField label="X" value="0" />
              <InputField label="Y" value="0" />
              <InputField label="W" value="375" />
              <InputField label="H" value="812" />
            </div>
          </PropertySection>

          {/* Fill */}
          <PropertySection title="Fill">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md border border-white/[0.1] bg-white" />
              <input
                className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-white/80 text-xs uppercase outline-none transition-colors focus:border-violet-500/50"
                defaultValue="FFFFFF"
                type="text"
              />
              <input
                className="w-14 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-white/80 text-xs outline-none transition-colors focus:border-violet-500/50"
                defaultValue="100%"
                type="text"
              />
            </div>
          </PropertySection>

          {/* Stroke */}
          <PropertySection defaultOpen={false} title="Stroke">
            <div className="flex items-center justify-center py-2 text-[10px] text-white/40">
              Click + to add stroke
            </div>
          </PropertySection>

          {/* Effects */}
          <PropertySection defaultOpen={false} title="Effects">
            <div className="flex items-center justify-center py-2 text-[10px] text-white/40">
              Click + to add effect
            </div>
          </PropertySection>
        </div>
      </Panel>
    </div>
  );
}
