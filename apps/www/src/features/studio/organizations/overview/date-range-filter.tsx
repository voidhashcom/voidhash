import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from "@voidhash/ui";
import { PlusIcon } from "lucide-react";

export type DateRange = "last_7d" | "last_30d" | "last_90d";
export type Granularity = "daily" | "weekly" | "monthly";

interface DateRangeFilterProps {
  dateRange: DateRange;
  granularity: Granularity;
  onDateRangeChange: (range: DateRange) => void;
  onGranularityChange: (granularity: Granularity) => void;
}

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "last_7d", label: "7D" },
  { value: "last_30d", label: "30D" },
  { value: "last_90d", label: "90D" },
];

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const isDateRange = (value: string): value is DateRange =>
  DATE_RANGE_OPTIONS.some((opt) => opt.value === value);

const isGranularity = (value: string): value is Granularity =>
  GRANULARITY_OPTIONS.some((opt) => opt.value === value);

export const DateRangeFilter = ({
  dateRange,
  granularity,
  onDateRangeChange,
  onGranularityChange,
}: DateRangeFilterProps) => (
  <div className="flex items-center gap-3">
    <ToggleGroup
      onValueChange={(value: string) => {
        if (value && isDateRange(value)) {
          onDateRangeChange(value);
        }
      }}
      type="single"
      value={dateRange}
    >
      {DATE_RANGE_OPTIONS.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="cursor-pointer">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>

    <Select
      onValueChange={(v: string) => {
        if (isGranularity(v)) {
          onGranularityChange(v);
        }
      }}
      value={granularity}
    >
      <SelectTrigger className="cursor-pointer">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GRANULARITY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value} className="cursor-pointer">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
