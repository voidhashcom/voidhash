import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { constant } from "../lang/index.ts";

export const CURRENCIES = constant({
  AED: "United Arab Emirates Dirham",
  AFN: "Afghanistan Afghani",
  ALL: "Albania Lek",
  AMD: "Armenia Dram",
  ANG: "Netherlands Antilles Guilder",
  AOA: "Angola Kwanza",
  ARS: "Argentina Peso",
  AUD: "Australia Dollar",
  AWG: "Aruba Guilder",
  AZN: "Azerbaijan New Manat",
  BAM: "Bosnia and Herzegovina Convertible Marka",
  BBD: "Barbados Dollar",
  BDT: "Bangladesh Taka",
  BGN: "Bulgaria Lev",
  BHD: "Bahrain Dinar",
  BIF: "Burundi Franc",
  BMD: "Bermuda Dollar",
  BND: "Brunei Darussalam Dollar",
  BOB: "Bolivia Bolíviano",
  BOV: "Bolivia Mvdol", // Fund code
  BRL: "Brazil Real",
  BSD: "Bahamas Dollar",
  BTN: "Bhutan Ngultrum",
  BWP: "Botswana Pula",
  BYN: "Belarus Ruble",
  BYR: "Belarus Ruble (old)",
  BZD: "Belize Dollar",
  CAD: "Canada Dollar",
  CDF: "Congo/Kinshasa Franc",
  CHE: "Switzerland WIR Euro", // Complementary currency
  CHF: "Switzerland Franc",
  CHW: "Switzerland WIR Franc", // Complementary currency
  CLF: "Chile Unidad de Fomento", // Fund code
  CLP: "Chile Peso",
  CNY: "China Yuan Renminbi",
  COP: "Colombia Peso",
  COU: "Colombia Unidad de Valor Real", // Fund code
  CRC: "Costa Rica Colon",
  CUC: "Cuba Convertible Peso", // Being phased out/largely replaced by CUP
  CUP: "Cuba Peso",
  CVE: "Cape Verde Escudo",
  CZK: "Czech Republic Koruna",
  DJF: "Djibouti Franc",
  DKK: "Denmark Krone",
  DOP: "Dominican Republic Peso",
  DZD: "Algeria Dinar",
  EGP: "Egypt Pound",
  ERN: "Eritrea Nakfa",
  ETB: "Ethiopia Birr",
  EUR: "Euro",
  FJD: "Fiji Dollar",
  FKP: "Falkland Islands Pound",
  GBP: "United Kingdom Pound",
  GEL: "Georgia Lari",
  GHS: "Ghana Cedi",
  GIP: "Gibraltar Pound",
  GMD: "Gambia Dalasi",
  GNF: "Guinea Franc",
  GTQ: "Guatemala Quetzal",
  GYD: "Guyana Dollar",
  HKD: "Hong Kong Dollar",
  HNL: "Honduras Lempira",
  HRK: "Croatia Kuna (historical, replaced by EUR)",
  HTG: "Haiti Gourde",
  HUF: "Hungary Forint",
  IDR: "Indonesia Rupiah",
  ILS: "Israel Shekel",
  IMP: "Isle of Man Pound", // Local issue, pegged to GBP
  INR: "India Rupee",
  IQD: "Iraq Dinar",
  IRR: "Iran Rial",
  ISK: "Iceland Krona",
  JEP: "Jersey Pound", // Local issue, pegged to GBP
  JMD: "Jamaica Dollar",
  JOD: "Jordan Dinar",
  JPY: "Japan Yen",
  KES: "Kenya Shilling",
  KGS: "Kyrgyzstan Som",
  KHR: "Cambodia Riel",
  KMF: "Comoros Franc",
  KPW: "North Korea Won",
  KRW: "South Korea Won",
  KWD: "Kuwait Dinar",
  KYD: "Cayman Islands Dollar",
  KZT: "Kazakhstan Tenge",
  LAK: "Laos Kip",
  LBP: "Lebanon Pound",
  LKR: "Sri Lanka Rupee",
  LRD: "Liberia Dollar",
  LSL: "Lesotho Loti",
  LYD: "Libya Dinar",
  MAD: "Morocco Dirham",
  MDL: "Moldova Leu",
  MGA: "Madagascar Ariary",
  MKD: "Macedonia Denar",
  MMK: "Myanmar Kyat",
  MNT: "Mongolia Tughrik",
  MOP: "Macau Pataca",
  MRU: "Mauritania Ouguiya",
  MRO: "Mauritania Ouguiya (old)",
  MUR: "Mauritius Rupee",
  MVR: "Maldives Rufiyaa",
  MWK: "Malawi Kwacha",
  MXN: "Mexico Peso",
  MXV: "Mexico Unidad de Inversion (UDI)", // Fund code
  MYR: "Malaysia Ringgit",
  MZN: "Mozambique Metical",
  NAD: "Namibia Dollar",
  NGN: "Nigeria Naira",
  NIO: "Nicaragua Cordoba",
  NOK: "Norway Krone",
  NPR: "Nepal Rupee",
  NZD: "New Zealand Dollar",
  OMR: "Oman Rial",
  PAB: "Panama Balboa",
  PEN: "Peru Sol",
  PGK: "Papua New Guinea Kina",
  PHP: "Philippines Peso",
  PKR: "Pakistan Rupee",
  PLN: "Poland Zloty",
  PYG: "Paraguay Guarani",
  QAR: "Qatar Riyal",
  RON: "Romania New Leu",
  RSD: "Serbia Dinar",
  RUB: "Russia Ruble",
  RWF: "Rwanda Franc",
  SAR: "Saudi Arabia Riyal",
  SBD: "Solomon Islands Dollar",
  SCR: "Seychelles Rupee",
  SDG: "Sudan Pound",
  SEK: "Sweden Krona",
  SGD: "Singapore Dollar",
  SHP: "Saint Helena Pound",
  SLE: "Sierra Leone Leone",
  SLL: "Sierra Leone Leone (old)",
  SOS: "Somalia Shilling",
  SSP: "South Sudan Pound",
  STN: "São Tomé and Príncipe Dobra",
  STD: "São Tomé and Príncipe Dobra (old)",
  SVC: "El Salvador Colon (historical, USD is primary currency)",
  SYP: "Syria Pound",
  SZL: "Eswatini Lilangeni",
  THB: "Thailand Baht",
  TJS: "Tajikistan Somoni",
  TMT: "Turkmenistan Manat",
  TND: "Tunisia Dinar",
  TOP: "Tonga Pa'anga",
  TRY: "Turkey Lira",
  TTD: "Trinidad and Tobago Dollar",
  TVD: "Tuvalu Dollar", // Pegged to AUD
  TWD: "Taiwan New Dollar",
  TZS: "Tanzania Shilling",
  UAH: "Ukraine Hryvnia",
  UGX: "Uganda Shilling",
  USD: "United States Dollar",
  USN: "United States Dollar (Next day)", // Fund code
  USS: "United States Dollar (Same day)", // Fund code, deprecated
  UYI: "Uruguay Peso en Unidades Indexadas", // Fund code
  UYU: "Uruguay Peso",
  UYW: "Unidad Previsional", // Fund code (Uruguay)
  UZS: "Uzbekistan Som",
  VED: "Venezuela Bolívar Digital",
  VEF: "Venezuela Bolívar (old)",
  VES: "Venezuela Bolívar Soberano (old)",
  VND: "Viet Nam Dong",
  VUV: "Vanuatu Vatu",
  WST: "Samoa Tala",
  XAF: "Communauté Financière Africaine BEAC Franc", // CFA Franc BEAC
  XAG: "Silver", // Precious metal
  XAU: "Gold", // Precious metal
  XBA: "European Composite Unit (EURCO)", // Bond market unit
  XBB: "European Monetary Unit (E.M.U.-6)", // Bond market unit
  XBC: "European Unit of Account (XBC)", // Bond market unit
  XBD: "European Unit of Account (XBD)", // Bond market unit
  XCD: "East Caribbean Dollar",
  XDR: "International Monetary Fund Special Drawing Rights",
  XOF: "Communauté Financière Africaine BCEAO Franc", // CFA Franc BCEAO
  XPD: "Palladium", // Precious metal
  XPF: "Comptoirs Français du Pacifique CFP Franc", // CFP Franc
  XPT: "Platinum", // Precious metal
  XSU: "SUCRE", // Regional currency
  XTS: "Testing Currency Code", // For testing purposes
  XUA: "ADB Unit of Account", // African Development Bank
  XXX: "No Currency", // For transactions where no currency is involved
  YER: "Yemen Rial",
  ZAR: "South Africa Rand",
  ZMW: "Zambia Kwacha",
  ZWL: "Zimbabwe Dollar (historical, replaced by ZiG)",
});

export type ISO4217CurrencyCode = keyof typeof CURRENCIES;

/** Narrows an arbitrary string to a known ISO 4217 currency code. */
const isISO4217CurrencyCode = (currency: string): currency is ISO4217CurrencyCode =>
  currency in CURRENCIES;

export class InvalidISO4217CurrencyCodeError extends Schema.TaggedErrorClass<InvalidISO4217CurrencyCodeError>(
  "InvalidISO4217CurrencyCodeError",
)("InvalidISO4217CurrencyCodeError", {
  code: Schema.String,
  message: Schema.String,
}) {}

/** Parses and validates an ISO 4217 currency code. */
export const parseISO4217CurrencyCode = (currency: string) =>
  Effect.gen(function* () {
    if (isISO4217CurrencyCode(currency)) {
      return currency;
    }

    return yield* Effect.fail(
      new InvalidISO4217CurrencyCodeError({
        code: "INVALID_ISO_4217_CURRENCY_CODE",
        message: `Invalid ISO 4217 currency code: ${currency}`,
      }),
    );
  });

/** The ISO 4217 minor-unit exponent used for every currency not listed in {@link CURRENCY_MINOR_UNIT_EXPONENTS}. */
export const DEFAULT_CURRENCY_MINOR_UNIT_EXPONENT = 2;

/**
 * ISO 4217 minor-unit exponents for every currency whose exponent is *not* the
 * near-universal 2. `10 ** exponent` minor units make one major unit, so JPY
 * (0) has no sub-unit at all while KWD (3) is divided into 1000 fils.
 *
 * Only the deviations are listed; {@link getCurrencyMinorUnitExponent} answers
 * {@link DEFAULT_CURRENCY_MINOR_UNIT_EXPONENT} for everything else.
 */
export const CURRENCY_MINOR_UNIT_EXPONENTS = constant<Partial<Record<ISO4217CurrencyCode, number>>>(
  {
    BHD: 3,
    BIF: 0,
    BYR: 0, // Historical; redenominated into the 2-decimal BYN.
    CLF: 4,
    CLP: 0,
    DJF: 0,
    GNF: 0,
    IQD: 3,
    ISK: 0,
    JOD: 3,
    JPY: 0,
    KMF: 0,
    KRW: 0,
    KWD: 3,
    LYD: 3,
    OMR: 3,
    PYG: 0,
    RWF: 0,
    TND: 3,
    UGX: 0,
    UYI: 0,
    UYW: 4,
    VND: 0,
    VUV: 0,
    XAF: 0,
    XOF: 0,
    XPF: 0,
  },
);

/**
 * Returns how many decimal places separate a currency's major unit from its
 * minor unit — the exponent that turns a major-unit amount into the integer
 * minor-unit amounts used across the purchase pipeline (`MinorAmount`).
 *
 * Unknown / non-currency codes (fund codes, precious metals) fall back to
 * {@link DEFAULT_CURRENCY_MINOR_UNIT_EXPONENT}.
 */
export const getCurrencyMinorUnitExponent = (currency: string): number => {
  if (!isISO4217CurrencyCode(currency)) return DEFAULT_CURRENCY_MINOR_UNIT_EXPONENT;
  return CURRENCY_MINOR_UNIT_EXPONENTS[currency] ?? DEFAULT_CURRENCY_MINOR_UNIT_EXPONENT;
};
