/**
 * Currency symbol resolution by country code.
 * The active symbol is set when the location payload loads (DesktopLayout /
 * BranchContext), and read by the report formatters.
 */
import { useEffect, useState } from 'react';

// Currency rule (per product): IN → '₹', US → '$', every other country → no symbol.
const USD_SYMBOL = '$';
const INR_SYMBOL = '₹';
const NO_SYMBOL = '';

// Default before the location payload loads: show no symbol rather than
// flashing a possibly-wrong one on first paint.
const DEFAULT_SYMBOL = NO_SYMBOL;

// Country codes whose outlets keep the '$' that backend text already carries.
const US_CODES = new Set(['US', 'USA']);

let _currentSymbol: string = DEFAULT_SYMBOL;
// Normalised country code of the selected outlet, or null until GET /details
// resolves it. Tracked separately from the symbol because two different
// countries can share the same (empty) symbol — see localizeCurrencyText.
let _currentCountry: string | null = null;
// Bumped on every resolution change (symbol OR country) so components that
// render country-dependent text — not just the symbol — can re-render.
let _revision = 0;
const _listeners = new Set<() => void>();

/** Resolve the symbol for a country code: IN → '₹', US → '$', otherwise → ''. */
export const getCurrencySymbolForCountry = (country?: string | null): string => {
    if (!country) return DEFAULT_SYMBOL;
    const code = String(country).toUpperCase().trim();
    if (code === 'IN' || code === 'IND' || code === 'INDIA') return INR_SYMBOL;
    if (code === 'US' || code === 'USA') return USD_SYMBOL;
    return NO_SYMBOL;
};

/** Read the active currency symbol. Empty string before location loads or for
 *  countries other than IN/US. */
export const getCurrencySymbol = (): string => _currentSymbol;

/** Money column header: `Label (₹)` / `Label ($)`, or just `Label` when the
 *  active symbol is empty — never `Label ()`. */
export const moneyHeader = (label: string): string => {
    const sym = _currentSymbol;
    return sym ? `${label} (${sym})` : label;
};

/**
 * Locale-aware grouped number formatting.
 *   countryCode 'US' / 'USA' → US grouping  (1,489,886.50)
 *   everything else          → Indian grouping (14,89,886.50)
 * Use ONLY for display + PDF export. CSV must stay raw/unformatted (commas
 * break arithmetic and turn cells into text in spreadsheets).
 */
export const formatGroupedNumber = (
    value: number | string | null | undefined,
    countryCode?: string | null,
    options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string => {
    if (value === null || value === undefined || value === '') return String(value ?? '');
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const code = String(countryCode ?? '').toUpperCase().trim();
    const locale = code === 'US' || code === 'USA' ? 'en-US' : 'en-IN';
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: options?.minimumFractionDigits ?? 0,
        maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(n);
};

/**
 * Monetary variant of {@link formatGroupedNumber}: whole numbers show no
 * decimals, fractional values show exactly 2dp (mirrors `formatMonetaryExport`),
 * with locale-aware grouping. Display / PDF only — never for CSV.
 */
export const formatGroupedMonetary = (
    value: number | string | null | undefined,
    countryCode?: string | null,
): string => {
    if (value === null || value === undefined || value === '') return String(value ?? '');
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return Number.isInteger(n)
        ? formatGroupedNumber(n, countryCode, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        : formatGroupedNumber(n, countryCode, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Money-cell formatter for exported files (CSV / Excel / PDF alike): active
 * currency symbol + locale-grouped number, e.g. "$1,234.50" / "₹1,23,456".
 *
 * Reads the symbol from the live singleton rather than taking a country param,
 * so it "just works" inside a multi-outlet ("All outlets") export — each
 * outlet's `buildExport` call already runs wrapped in
 * `withCurrencySymbolForCountry`, so the singleton is correctly scoped to that
 * outlet's currency for the duration of the call. This makes every exported
 * money cell self-describing (its own row states its own currency) instead of
 * relying on a single shared column header, which breaks the moment a merged
 * "All outlets" table spans more than one currency.
 *
 * Cells built this way are intentionally TEXT, not numbers — Excel/Sheets can
 * no longer natively SUM them. That's the accepted trade for correctness
 * across mixed-currency exports (product decision).
 */
export const formatMoneyForExport = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === '') return String(value ?? '');
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const sym = _currentSymbol;
    // Grouping style follows the active symbol (₹ → Indian grouping, else → US
    // grouping) rather than a separately-threaded country code — the symbol IS
    // the resolved-country signal at this point in the call.
    const locale = sym === INR_SYMBOL ? 'en-IN' : 'en-US';
    const grouped = new Intl.NumberFormat(locale, {
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
    return `${sym}${grouped}`;
};

/** Single write path for the active currency: sets symbol + country together and
 *  notifies once, bumping the revision so country-only changes still re-render. */
const setActiveCurrency = (symbol: string, country: string | null): void => {
    if (symbol === _currentSymbol && country === _currentCountry) return;
    _currentSymbol = symbol;
    _currentCountry = country;
    _revision += 1;
    _listeners.forEach((fn) => { try { fn(); } catch { /* swallow */ } });
};

/** Set the active symbol from a country code (called when location payload loads).
 *  Only updates when a country is provided so we never reset back to the default on
 *  intermediate state changes (e.g. dropdown click before details fetch). A provided
 *  but non-IN/US country DOES set '' — that is the "display nothing" case. */
export const setCurrentCurrencyByCountry = (country?: string | null): void => {
    if (!country) return;
    const code = String(country).toUpperCase().trim();
    setActiveCurrency(getCurrencySymbolForCountry(code), code);
};

/**
 * Temporarily switch the active currency to `country`'s for the duration of `fn`, then restore
 * whatever was active before — so a per-outlet export ("All outlets") can reuse every existing
 * `getCurrencySymbol()` / `fmtCurrency()` / `moneyHeader()` call site unmodified and have it
 * resolve to THAT outlet's currency instead of the globally-selected outlet's.
 *
 * The **country** is overridden alongside the symbol, so `localizeCurrencyText` is scoped to the
 * same outlet — otherwise an export could pair one outlet's amounts with another outlet's
 * "$ Off" labels. A falsy `country` scopes to "unknown": no symbol, and text left as sent.
 *
 * NOT safe to run concurrently — `fn` calls for different outlets must be awaited sequentially
 * (never Promise.all'd), otherwise their overrides race and corrupt each other's output.
 */
export const withCurrencySymbolForCountry = async <T>(country: string | undefined | null, fn: () => Promise<T> | T): Promise<T> => {
    const previousSymbol = _currentSymbol;
    const previousCountry = _currentCountry;
    setActiveCurrency(getCurrencySymbolForCountry(country), country ? String(country).toUpperCase().trim() : null);
    try {
        return await fn();
    } finally {
        setActiveCurrency(previousSymbol, previousCountry);
    }
};

/** True once the outlet's country is known AND it is a US outlet. Unresolved
 *  (no /details yet) reads as false — callers must treat that as "unknown". */
export const isUsOutlet = (): boolean => _currentCountry !== null && US_CODES.has(_currentCountry);

/**
 * Rewrite a currency symbol the BACKEND embedded in display text — an offer
 * type like `"$ Off"`, an offer name like `"$5 Off Orders Over $30"`. US
 * outlets keep the '$'; every other outlet shows '₹'.
 *
 * Deliberately NOT getCurrencySymbol(): that resolves to '' for countries
 * outside IN/US, and stripping the symbol out of a label would leave a
 * dangling " Off". Text is left untouched until the country resolves, so a US
 * outlet never flashes '₹' on first paint (components re-render via
 * useCurrencyRevision when it lands).
 */
export function localizeCurrencyText<T extends string | null | undefined>(text: T): T {
    if (typeof text !== 'string' || !text.includes(USD_SYMBOL)) return text;
    if (_currentCountry === null || isUsOutlet()) return text;
    return text.split(USD_SYMBOL).join(INR_SYMBOL) as T;
}

/** Subscribe to ANY currency resolution change (symbol or country) and
 *  re-render. Use in components rendering localizeCurrencyText output —
 *  useCurrencySymbol can't cover it, because resolving to an unmapped country
 *  leaves the symbol at '' and React bails out of the identical setState. */
export const useCurrencyRevision = (): number => {
    const [revision, setRevision] = useState<number>(_revision);
    useEffect(() => {
        const listener = () => setRevision(_revision);
        _listeners.add(listener);
        if (revision !== _revision) setRevision(_revision);
        return () => { _listeners.delete(listener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return revision;
};

/** Subscribe to currency-symbol changes. Returns the active symbol and re-renders
 *  the calling component when the active symbol changes. */
export const useCurrencySymbol = (): string => {
    const [symbol, setSymbol] = useState<string>(_currentSymbol);
    useEffect(() => {
        const listener = () => setSymbol(_currentSymbol);
        _listeners.add(listener);
        // Sync once on mount in case _currentSymbol changed between render & effect.
        if (symbol !== _currentSymbol) setSymbol(_currentSymbol);
        return () => { _listeners.delete(listener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return symbol;
};
