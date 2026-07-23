import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ToggleGroup,
  ToggleGroupItem,
} from "@voidhash/ui";
import { IconPlaceholder } from "../icon-placeholder";

export function ProjectActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Actions</CardTitle>
        <CardDescription>Manage and publish your current project.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <IconPlaceholder
              lucide="MoreHorizontalIcon"
              tabler="IconDots"
              hugeicons="MoreHorizontalCircle01Icon"
              phosphor="DotsThreeIcon"
              remixicon="RiMoreLine"
            />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Filter project">
            <IconPlaceholder
              lucide="ListFilterIcon"
              tabler="IconFilter"
              hugeicons="FilterHorizontalIcon"
              phosphor="FunnelIcon"
              remixicon="RiFilter3Line"
            />
          </Button>
          <Button variant="secondary" size="sm">
            <IconPlaceholder
              lucide="PlusIcon"
              tabler="IconPlus"
              hugeicons="Add01Icon"
              phosphor="PlusIcon"
              remixicon="RiAddLine"
              data-icon="inline-start"
            />
            Add
          </Button>

          <Button variant="ghost" size="sm">
            Cancel
          </Button>
          <Button variant="outline" size="sm">
            Preview
          </Button>
          <Button variant="secondary" size="sm">
            Copy
          </Button>
          <Button size="sm">Publish</Button>

          <ToggleGroup type="single" defaultValue="grid">
            <ToggleGroupItem value="list" aria-label="List view">
              <IconPlaceholder
                lucide="ListIcon"
                tabler="IconList"
                hugeicons="LeftToRightListBulletIcon"
                phosphor="ListBulletsIcon"
                remixicon="RiListUnordered"
              />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <IconPlaceholder
                lucide="LayoutGridIcon"
                tabler="IconLayoutGrid"
                hugeicons="GridViewIcon"
                phosphor="GridFourIcon"
                remixicon="RiGridFill"
              />
            </ToggleGroupItem>
            <ToggleGroupItem value="columns" aria-label="Columns view">
              <IconPlaceholder
                lucide="Columns3Icon"
                tabler="IconColumns3"
                hugeicons="Layout3ColumnIcon"
                phosphor="ColumnsIcon"
                remixicon="RiLayoutColumnLine"
              />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardContent>
    </Card>
  );
}
