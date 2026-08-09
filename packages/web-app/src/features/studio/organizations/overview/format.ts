// ---------------------------------------------------------------------------
// Formatting utilities for the organization overview dashboard.
// Uses Intl.NumberFormat, matching existing patterns (kpi-card.tsx).
// ---------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyDecimalFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");
const percentValueFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export type MetricValueFormat = "currency" | "number" | "percent";

export const formatCurrency = (value: number): string => {
  if (Number.isInteger(value)) {
    return currencyFormatter.format(value);
  }
  return currencyDecimalFormatter.format(value);
};

export const formatNumber = (value: number): string => numberFormatter.format(value);

export const formatPercentValue = (value: number): string =>
  `${percentValueFormatter.format(value)}%`;

export const formatMetricValue = (value: number, valueFormat: MetricValueFormat): string => {
  switch (valueFormat) {
    case "currency":
      return formatCurrency(value);
    case "percent":
      return formatPercentValue(value);
    case "number":
    default:
      return formatNumber(value);
  }
};

export const formatPercentChange = (change: number): string => {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

export const formatCompactCurrency = (value: number): string => {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }
  return `$${value}`;
};
