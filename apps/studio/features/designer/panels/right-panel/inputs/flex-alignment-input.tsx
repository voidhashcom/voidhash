import type { AlignItems, FlexDirection, JustifyContent } from "@voidhash/dff";
import {
	cn,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@voidhash/ui";
import {
	AlignCenterHorizontal,
	AlignCenterVertical,
	AlignEndHorizontal,
	AlignEndVertical,
	AlignStartHorizontal,
	AlignStartVertical,
	Settings2Icon,
} from "lucide-react";
import { PanelButton } from "../../core/components/button";

type FlexAlignmentInputProps = {
	flexDirection: FlexDirection;
	alignItems: AlignItems;
	justifyContent: JustifyContent;
	onChange: (changes: {
		alignItems: AlignItems;
		justifyContent: JustifyContent;
	}) => void;
};

function createJustifyContentGridInfo() {
	const justifyContent = ["flex-start", "center", "flex-end"] as const;
	const alignItems = ["flex-start", "center", "flex-end"] as const;

	const createColumnGridInfo = () => {
		return Array.from({ length: 3 }).map((_, rowIndex) => {
			return Array.from({ length: 3 }).map((_, columnIndex) => {
				const keyIndex = `${rowIndex}-${columnIndex}` as const;
				const icons = [
					<AlignStartVertical
						key={`start-vertical-${keyIndex}`}
						className="size-3"
					/>,
					<AlignCenterVertical
						key={`center-vertical-${keyIndex}`}
						className="size-3"
					/>,
					<AlignEndVertical
						key={`end-vertical-${keyIndex}`}
						className="size-3"
					/>,
				];

				const icon = icons[columnIndex];
				const justifyContentValue = justifyContent[rowIndex];
				const alignItemsValue = alignItems[columnIndex];

				if (!icon || !justifyContentValue || !alignItemsValue) {
					throw new Error("Invalid icon, justifyContent, or alignItems");
				}

				return {
					icon,
					justifyContent: justifyContentValue,
					alignItems: alignItemsValue,
				};
			});
		});
	};

	const createRowGridInfo = () => {
		return Array.from({ length: 3 }).map((_, rowIndex) => {
			return Array.from({ length: 3 }).map((_, columnIndex) => {
				const keyIndex = `${rowIndex}-${columnIndex}` as const;
				const icons = [
					<AlignStartHorizontal
						key={`start-horizontal-${keyIndex}`}
						className="size-3"
					/>,
					<AlignCenterHorizontal
						key={`center-horizontal-${keyIndex}`}
						className="size-3"
					/>,
					<AlignEndHorizontal
						key={`end-horizontal-${keyIndex}`}
						className="size-3"
					/>,
				];

				const icon = icons[rowIndex];
				const justifyContentValue = justifyContent[columnIndex];
				const alignItemsValue = alignItems[rowIndex];

				if (!icon || !justifyContentValue || !alignItemsValue) {
					throw new Error("Invalid icon, justifyContent, or alignItems");
				}

				return {
					icon,
					justifyContent: justifyContentValue,
					alignItems: alignItemsValue,
				};
			});
		});
	};

	return {
		column: createColumnGridInfo(),
		row: createRowGridInfo(),
	};
}

const JUSTIFY_CONTENT_GRID = createJustifyContentGridInfo();

function StretchIllustration({
	direction,
	alignItems,
	className,
}: {
	direction: FlexDirection;
	alignItems: AlignItems;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-1 justify-around items-center",
				className,
				direction === "row" ? "flex-row" : "flex-col",
			)}
			style={{ alignItems }}
		>
			<div
				className={cn(
					"bg-[currentColor] rounded-md",
					direction === "row" ? "w-0.5 h-2" : "h-0.5 w-2",
				)}
			></div>
			<div
				className={cn(
					"bg-[currentColor] rounded-md",
					direction === "row" ? "w-0.5 h-2" : "h-0.5 w-2",
				)}
			></div>
			<div
				className={cn(
					"bg-[currentColor] rounded-md",
					direction === "row" ? "w-0.5 h-2" : "h-0.5 w-2",
				)}
			></div>
		</div>
	);
}

const ALIGN_ITEMS = ["flex-start", "center", "flex-end"] as const;

export function FlexAlignmentInput({
	flexDirection,
	alignItems,
	justifyContent,
	onChange,
}: FlexAlignmentInputProps) {
	const justifyContentType = (() => {
		if (justifyContent === "space-between" && flexDirection === "row") {
			return "row-space-between";
		}
		if (justifyContent === "space-between" && flexDirection === "column") {
			return "column-space-between";
		}
		return "no-justify-content";
	})();

	const getGridItem = (rowIndex: number, columnIndex: number) => {
		const gridItem =
			JUSTIFY_CONTENT_GRID[flexDirection]?.[rowIndex]?.[columnIndex];

		if (!gridItem) {
			throw new Error("Invalid grid item");
		}

		return gridItem;
	};

	const getAlignItems = (rowIndex: number) => {
		const alignItems = ALIGN_ITEMS[rowIndex];
		if (!alignItems) {
			throw new Error("Invalid align items");
		}
		return alignItems;
	};

	return (
		<>
			<div className="flex shrink-0 flex-1 rounded-sm bg-input/60">
				{justifyContentType === "no-justify-content" && (
					<div className="flex flex-1 flex-col">
						{Array.from({ length: 3 }).map((_, rowIndex) => (
							<div
								className="flex flex-1 flex-row"
								key={`row-${rowIndex}-${flexDirection}`}
							>
								{Array.from({ length: 3 }).map((_, columnIndex) => (
									// biome-ignore lint/a11y/noStaticElementInteractions: We need to use a div to get the pointer lock to work
									// biome-ignore lint/a11y/useKeyWithClickEvents: We need to use a div to get the pointer lock to work
									<div
										className="relative py-1 w-7 flex-1 hover:bg-input/80 group items-center justify-center"
										key={`cell-${rowIndex}-${columnIndex}-${flexDirection}`}
										style={{ minWidth: 16 }}
										onClick={() =>
											onChange({
												alignItems: getGridItem(rowIndex, columnIndex)
													.alignItems,
												justifyContent: getGridItem(rowIndex, columnIndex)
													.justifyContent,
											})
										}
									>
										{/* Dot indicating an empty cell */}
										{!(
											alignItems ===
												getGridItem(rowIndex, columnIndex).alignItems &&
											justifyContent ===
												getGridItem(rowIndex, columnIndex).justifyContent
										) && (
											<span
												aria-hidden="true"
												className="group-hover:hidden block -translate-x-1/2 -translate-y-1/2 before:-translate-x-1/2 before:-translate-y-1/2 absolute top-1/2 left-1/2 before:absolute before:top-1/2 before:left-1/2 before:block before:h-0.5 before:w-0.5 before:rounded-full before:bg-muted-foreground before:content-['']"
											/>
										)}

										{/* Stretch illustration */}
										<div
											className={cn(
												"absolute hidden group-hover:block top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400",
												getGridItem(rowIndex, columnIndex).alignItems ===
													alignItems &&
													getGridItem(rowIndex, columnIndex).justifyContent ===
														justifyContent &&
													"text-white block group-hover:block group-hover:text-white",
											)}
										>
											{getGridItem(rowIndex, columnIndex).icon}
										</div>
									</div>
								))}
							</div>
						))}
					</div>
				)}

				{justifyContentType === "row-space-between" && (
					<div className="flex flex-1 flex-col">
						{Array.from({ length: 3 }).map((_, rowIndex) => (
							// biome-ignore lint/a11y/noStaticElementInteractions: We need to use a div to get the pointer lock to work
							// biome-ignore lint/a11y/useKeyWithClickEvents: We need to use a div to get the pointer lock to work
							<div
								className={cn(
									"relative py-1 w-21 flex-1 hover:bg-input/80 group items-center justify-center flex-row flex group text-gray-400",
									getAlignItems(rowIndex) === alignItems && "bg-input/80",
								)}
								key={`row-${rowIndex}-${flexDirection}`}
								onClick={() =>
									onChange({
										alignItems: getAlignItems(rowIndex),
										justifyContent: "space-between" as const,
									})
								}
							>
								{/* Dot indicating an empty cell */}
								{getAlignItems(rowIndex) !== alignItems && (
									<span
										aria-hidden="true"
										className="group-hover:hidden block -translate-x-1/2 -translate-y-1/2 before:-translate-x-1/2 before:-translate-y-1/2 absolute top-1/2 left-1/2 before:absolute before:top-1/2 before:left-1/2 before:block before:h-0.5 before:w-0.5 before:rounded-full before:bg-muted-foreground before:content-['']"
									/>
								)}

								{/* Stretch illustration */}

								<StretchIllustration
									className={cn(
										getAlignItems(rowIndex) === alignItems
											? "text-white flex"
											: "hidden group-hover:flex",
									)}
									direction="row"
									alignItems={getAlignItems(rowIndex)}
								/>
							</div>
						))}
					</div>
				)}

				{justifyContentType === "column-space-between" && (
					<div className="flex flex-1 flex-row items-center">
						{Array.from({ length: 3 }).map((_, columnIndex) => (
							// biome-ignore lint/a11y/noStaticElementInteractions: We need to use a div to get the pointer lock to work
							// biome-ignore lint/a11y/useKeyWithClickEvents: We need to use a div to get the pointer lock to work
							<div
								className={cn(
									"relative py-1 h-full w-7 flex-1 hover:bg-input/80 group items-center justify-center flex-col flex group text-gray-400",
									getAlignItems(columnIndex) === alignItems && "bg-input/80",
								)}
								key={`row-${columnIndex}-${flexDirection}`}
								onClick={() =>
									onChange({
										alignItems: getAlignItems(columnIndex),
										justifyContent: "space-between" as const,
									})
								}
							>
								{/* Dot indicating an empty cell */}
								{getAlignItems(columnIndex) !== alignItems && (
									<span
										aria-hidden="true"
										className="group-hover:hidden block -translate-x-1/2 -translate-y-1/2 before:-translate-x-1/2 before:-translate-y-1/2 absolute top-1/2 left-1/2 before:absolute before:top-1/2 before:left-1/2 before:block before:h-0.5 before:w-0.5 before:rounded-full before:bg-muted-foreground before:content-['']"
									/>
								)}

								{/* Stretch illustration */}

								<StretchIllustration
									className={cn(
										getAlignItems(columnIndex) === alignItems
											? "text-white flex"
											: "hidden group-hover:flex",
									)}
									direction="column"
									alignItems={getAlignItems(columnIndex)}
								/>
							</div>
						))}
					</div>
				)}
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<PanelButton icon={<Settings2Icon className="size-3.5" />} />
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuCheckboxItem
						checked={justifyContent === "space-between"}
						onCheckedChange={() =>
							onChange({
								alignItems,
								justifyContent:
									justifyContent === "space-between"
										? ("flex-start" as const)
										: ("space-between" as const),
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
