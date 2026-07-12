/**
 * Estimated VAT / GST / sales-tax rates by storefront, keyed by ISO 3166
 * alpha-3 country code (Apple's `storefront` JWS field shape, e.g., `"USA"`,
 * `"DEU"`).
 *
 * Values are expressed as basis points (`1500` = 15.00%) so commission and
 * tax math stays in integer space alongside the existing minor-unit amounts
 * on `transaction`.
 *
 * Rates cover regions where Apple is the merchant of record and the JWS
 * `price` therefore includes consumption tax that Apple later withholds —
 * i.e. EU member states, UK, Switzerland, Norway, Japan, Australia. Tax for
 * unlisted countries defaults to `0` (US sales tax handled per-state by
 * Apple's reporting layer, not the JWS).
 *
 * This table is intentionally approximate. Authoritative tax accounting
 * happens against Apple's monthly App Store Connect financial reports; this
 * exists so the JWS-driven analytics path can populate a reasonable
 * `taxAmount` field for live dashboards.
 */
export const STOREFRONT_VAT_RATES_BPS: Readonly<Record<string, number>> = {
  // European Union — standard VAT rates (2026 reference).
  AUT: 2000, // Austria
  BEL: 2100, // Belgium
  BGR: 2000, // Bulgaria
  CYP: 1900, // Cyprus
  CZE: 2100, // Czechia
  DEU: 1900, // Germany
  DNK: 2500, // Denmark
  ESP: 2100, // Spain
  EST: 2200, // Estonia
  FIN: 2550, // Finland
  FRA: 2000, // France
  GRC: 2400, // Greece
  HRV: 2500, // Croatia
  HUN: 2700, // Hungary
  IRL: 2300, // Ireland
  ITA: 2200, // Italy
  LTU: 2100, // Lithuania
  LUX: 1700, // Luxembourg
  LVA: 2100, // Latvia
  MLT: 1800, // Malta
  NLD: 2100, // Netherlands
  POL: 2300, // Poland
  PRT: 2300, // Portugal
  ROU: 2100, // Romania (raised from 19%)
  SVK: 2300, // Slovakia
  SVN: 2200, // Slovenia
  SWE: 2500, // Sweden

  // Other Apple-merchant-of-record markets.
  AUS: 1000, // Australia GST
  CHE: 810, // Switzerland VAT
  GBR: 2000, // United Kingdom VAT
  ISL: 2400, // Iceland VAT
  JPN: 1000, // Japan consumption tax
  LIE: 810, // Liechtenstein VAT (matches Switzerland)
  NOR: 2500, // Norway VAT
  NZL: 1500, // New Zealand GST
} as const;

/**
 * Looks up the estimated tax rate (in basis points) for an Apple storefront
 * country. Returns `0` when the storefront is unknown or omitted.
 */
export const getStorefrontVatRateBps = (storefront: string | undefined | null): number => {
  if (!storefront) return 0;
  const upper = storefront.toUpperCase();
  return STOREFRONT_VAT_RATES_BPS[upper] ?? 0;
};
