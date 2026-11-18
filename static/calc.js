// Shared helpers for every calculator on tools.ezrasnotes.com.
// No tool-specific math lives here.

export const UNITS = { "1": "units", "1000": "thousands", "1000000": "millions" };

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "HKD",
  "SGD", "SEK", "NOK", "DKK", "MXN", "BRL", "CLP", "COP", "KRW", "INR", "ZAR"];

// Turns what a person typed into a number.
// Accepts "1,234.5", "1 234.5" and "$1,234". Returns:
//   null      when the field is empty
//   NaN       when it isn't a number (letters, two dots, etc.)
//   a number  otherwise
export function parseNumber(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s === "") return null;
  s = s.replace(/[\s,$€£¥]/g, "");
  if (s.endsWith("%")) s = s.slice(0, -1);
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

export function money(value, currency, decimals, minDecimals = decimals) {
  if (value === null || value === undefined || !isFinite(value)) return "n/m";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency,
      minimumFractionDigits: minDecimals, maximumFractionDigits: decimals }).format(value);
  } catch (e) {
    return currency + " " + value.toFixed(decimals);
  }
}

// Per-share values: cents, or a tenth of a cent for stocks under one unit of currency.
export function perShare(value, currency, price) {
  const d = Math.abs(price) < 1 || Math.abs(value) < 1 ? 3 : 2;
  return money(value, currency, d, 2);
}

// Totals are shown back in the unit the person typed them in.
export function amount(value, unit) {
  if (value === null || !isFinite(value)) return "n/m";
  const v = value / unit;
  const s = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: unit === 1000000 ? 1 : 0 });
  return (v < 0 ? "(" + s + ")" : s);
}

export function multiple(x) {
  return x === null || !isFinite(x) ? "n/m" : x.toFixed(2) + "x";
}

export function pct(x, decimals = 0) {
  return (x * 100).toFixed(decimals) + "%";
}

// "a 60% discount" but "an 8% discount", "an 11%...", "an 18%...".
export function article(numText) {
  return /^(8|11(?!\d)|18(?!\d))/.test(numText) ? "an" : "a";
}

// Google Analytics event. Does nothing if Analytics isn't loaded.
export function track(name, params) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, params || {});
  }
}

// Puts the inputs in the address bar so the calculation can be shared.
export function shareUrl(values) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  Object.entries(values).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

export function readQuery() {
  const out = {};
  new URLSearchParams(window.location.search).forEach((v, k) => { out[k] = v; });
  return out;
}

export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve) => { window.prompt("Copy this link:", text); resolve(); });
}
