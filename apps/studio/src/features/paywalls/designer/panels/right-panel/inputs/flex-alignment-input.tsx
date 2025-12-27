import type {
  AlignItems,
  FlexDirection,
  JustifyContent
} from '@voidhash/mimic-schema';
import {
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@voidhash/ui';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Settings2Icon
} from 'lucide-react';
import { PanelButton } from '@/features/designer/components/button';

type FlexAlignmentInputProps = {
  flexDirection: FlexDirection;
  alignItems: AlignItems;
  justifyContent: JustifyContent;
  onChange: (changes: {
    alignItems: AlignItems;
    justifyContent: JustifyContent;
  }) => void;
};

const ALIGN_VALUES = ['flex-start', 'center', 'flex-end'] as const;

const DOT_CLASS =
  "group-hover:hidden block -translate-x-1/2 -translate-y-1/2 before:-translate-x-1/2 before:-translate-y-1/2 absolute top-1/2 left-1/2 before:absolute before:top-1/2 before:left-1/2 before:block before:h-0.5 before:w-0.5 before:rounded-full before:bg-muted-foreground before:content-['']";

type GridItem = {
  icon: React.ReactNode;
  justifyContent: (typeof ALIGN_VALUES)[number];
  alignItems: (typeof ALIGN_VALUES)[number];
};

function createGridInfo() {
  const columnIcons = [
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical
  ];
  const rowIcons = [
    AlignStartHorizontal,
    AlignCenterHorizontal,
    AlignEndHorizontal
  ];

  const createGrid = (isColumn: boolean): GridItem[][] =>
    ALIGN_VALUES.map((_, rowIndex) =>
      ALIGN_VALUES.map((_, columnIndex) => {
        const Icon = isColumn ? columnIcons[columnIndex] : rowIcons[rowIndex];

        if (!Icon) {
          throw new Error('Invalid icon index');
        }

        return {
          icon: <Icon className="size-3" />,
          justifyContent: ALIGN_VALUES[isColumn ? rowIndex : columnIndex],
          alignItems: ALIGN_VALUES[isColumn ? columnIndex : rowIndex]
        } as GridItem;
      })
    );

  return {
    column: createGrid(true),
    row: createGrid(false)
  };
}

const GRID = createGridInfo();

function StretchIllustration({
  direction,
  alignItems,
  className
}: {
  direction: FlexDirection;
  alignItems: AlignItems;
  className?: string;
}) {
  const isRow = direction === 'row';
  const barClass = cn(
    'rounded-md bg-[currentColor]',
    isRow ? 'h-2 w-0.5' : 'h-0.5 w-2'
  );

  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-around',
        className,
        isRow ? 'flex-row' : 'flex-col'
      )}
      style={{ alignItems }}
    >
      <div className={barClass} />
      <div className={barClass} />
      <div className={barClass} />
    </div>
  );
}

function DotIndicator() {
  return <span aria-hidden="true" className={DOT_CLASS} />;
}

export function FlexAlignmentInput({
  flexDirection,
  alignItems,
  justifyContent,
  onChange
}: FlexAlignmentInputProps) {
  const isSpaceBetween = justifyContent === 'space-between';

  const getGridItem = (rowIndex: number, columnIndex: number): GridItem => {
    const gridItem = GRID[flexDirection]?.[rowIndex]?.[columnIndex];
    if (!gridItem) {
      throw new Error('Invalid grid item');
    }
    return gridItem;
  };

  const getAlignValue = (index: number) => {
    const value = ALIGN_VALUES[index];
    if (!value) {
      throw new Error('Invalid align value');
    }
    return value;
  };

  const isSelected = (
    itemAlignItems: AlignItems,
    itemJustify: JustifyContent
  ) => alignItems === itemAlignItems && justifyContent === itemJustify;

  return (
    <>
      <div className="flex flex-1 shrink-0 rounded-sm bg-input/60">
        {/* Shows a 3x3 grid of alignment options. */}
        {!isSpaceBetween && (
          <div className="flex flex-1 flex-col">
            {ALIGN_VALUES.map((_, rowIndex) => (
              <div
                className="flex flex-1 flex-row"
                key={`row-${rowIndex}-${flexDirection}`}
              >
                {ALIGN_VALUES.map((_, columnIndex) => {
                  const item = getGridItem(rowIndex, columnIndex);
                  const selected = isSelected(
                    item.alignItems,
                    item.justifyContent
                  );

                  return (
                    // biome-ignore lint/a11y/noStaticElementInteractions: Grid cell interaction
                    // biome-ignore lint/a11y/useKeyWithClickEvents: Grid cell interaction
                    <div
                      className="group relative w-7 flex-1 items-center justify-center py-1 hover:bg-input/80"
                      key={`cell-${rowIndex}-${columnIndex}-${flexDirection}`}
                      onClick={() =>
                        onChange({
                          alignItems: item.alignItems,
                          justifyContent: item.justifyContent
                        })
                      }
                      style={{ minWidth: 16 }}
                    >
                      {!selected && <DotIndicator />}
                      <div
                        className={cn(
                          '-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 hidden text-gray-400 group-hover:block',
                          selected &&
                            'block text-white group-hover:block group-hover:text-white'
                        )}
                      >
                        {item.icon}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Shows a 3 rows of vertical alignment options . */}
        {isSpaceBetween && flexDirection === 'row' && (
          <div className="flex flex-1 flex-col">
            {ALIGN_VALUES.map((_, rowIndex) => {
              const itemAlignItems = getAlignValue(rowIndex);
              const selected = itemAlignItems === alignItems;

              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: Grid cell interaction
                // biome-ignore lint/a11y/useKeyWithClickEvents: Grid cell interaction
                <div
                  className={cn(
                    'group group relative flex w-21 flex-1 flex-row items-center justify-center py-1 text-gray-400 hover:bg-input/80',
                    selected && 'bg-input/80'
                  )}
                  key={`row-${rowIndex}-${flexDirection}`}
                  onClick={() =>
                    onChange({
                      alignItems: itemAlignItems,
                      justifyContent: 'space-between'
                    })
                  }
                >
                  {!selected && <DotIndicator />}
                  <StretchIllustration
                    alignItems={itemAlignItems}
                    className={cn(
                      selected ? 'flex text-white' : 'hidden group-hover:flex'
                    )}
                    direction="row"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Shows a 3 columns of horizontal alignment options. */}
        {isSpaceBetween && flexDirection === 'column' && (
          <div className="flex flex-1 flex-row items-center">
            {ALIGN_VALUES.map((_, columnIndex) => {
              const itemAlignItems = getAlignValue(columnIndex);
              const selected = itemAlignItems === alignItems;

              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: Grid cell interaction
                // biome-ignore lint/a11y/useKeyWithClickEvents: Grid cell interaction
                <div
                  className={cn(
                    'group group relative flex h-full w-7 flex-1 flex-col items-center justify-center py-1 text-gray-400 hover:bg-input/80',
                    selected && 'bg-input/80'
                  )}
                  key={`col-${columnIndex}-${flexDirection}`}
                  onClick={() =>
                    onChange({
                      alignItems: itemAlignItems,
                      justifyContent: 'space-between'
                    })
                  }
                >
                  {!selected && <DotIndicator />}
                  <StretchIllustration
                    alignItems={itemAlignItems}
                    className={cn(
                      selected ? 'flex text-white' : 'hidden group-hover:flex'
                    )}
                    direction="column"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PanelButton icon={<Settings2Icon className="size-3.5" />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem
            checked={isSpaceBetween}
            onCheckedChange={() =>
              onChange({
                alignItems,
                justifyContent: isSpaceBetween ? 'flex-start' : 'space-between'
              })
            }
          >
            <span>Space between</span>
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
