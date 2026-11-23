// PVGO calculator. Same arithmetic as PVGO_Template.xlsx.
// Mauboussin and Callahan, "Opportunities and Expectations: The Present Value of Growth Opportunities in Valuation"
// (Counterpoint Global, June 18, 2026). Value = steady-state value + PVGO.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const N = (v) => (has(v) ? v : 0);
const SHIFTS = [-0.01, 0, 0.01];

// A. From earnings: steady state = earnings / cost of equity.
export function fromEarnings(earnings, rate, price) {
  const ok = rate > 0 && has(earnings);
  const ss = ok ? earnings / rate : null;
  const pvgo = ok && price > 0 ? price - ss : null;
  const share = pvgo !== null ? pvgo / price : null;
  const at = (r) => (has(earnings) && price > 0 ? (price - earnings / r) / price : null);
  return {
    ssPE: rate > 0 ? 1 / rate : null, pe: earnings > 0 && price > 0 ? price / earnings : null,
    ss, pvgo, share, ssShare: share === null ? null : 1 - share,
    sens: SHIFTS.map((d) => { const r = N(rate) + d; return rate > 0 && r > 0 ? [r, at(r)] : [null, null]; }),
  };
}

// B. From NOPAT: steady state = NOPAT / WACC - net debt.
export function fromNopat(nopat, wacc, netDebt, equity) {
  const ev = wacc > 0 && has(nopat) ? nopat / wacc : null;
  const ssEq = ev === null ? null : ev - N(netDebt);
  const pvgo = ssEq !== null && equity > 0 ? equity - ssEq : null;
  const share = pvgo !== null ? pvgo / equity : null;
  const at = (r) => (has(nopat) && equity > 0 ? (equity - (nopat / r - N(netDebt))) / equity : null);
  return {
    ev, ssEq, pvgo, share, ssShare: share === null ? null : 1 - share,
    sens: SHIFTS.map((d) => { const r = N(wacc) + d; return wacc > 0 && r > 0 ? [r, at(r)] : [null, null]; }),
  };
}

// NOPAT helper: operating income x (1 - tax rate), the shortcut in Mauboussin and Callahan's "Return on Invested Capital" (2022).
export function nopatHelper(ebit, tax) {
  return { nopat: has(ebit) ? ebit * (1 - N(tax)) : null };
}

export function check(raw) {
  const errors = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  if (has(raw.tax) && (raw.tax < 0 || raw.tax >= 100)) errors.push(["tax", "Between 0 and 100."]);
  for (const k of ["rate", "wacc", "price", "equity"]) if (has(raw[k]) && raw[k] <= 0) errors.push([k, "Must be more than zero."]);
  return errors;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("pvform")) {
  const form = document.getElementById("pvform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const num = (v) => (v === null ? "–" : (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const P = (v, d = 1) => (v === null ? "–" : (v < 0 ? "−" : "") + pct(Math.abs(v), d));
  const X = (v) => (v === null ? "–" : v.toFixed(1) + "x");
  function set(id, text, neg) { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); }
  function showErrors(errors) {
    fields.forEach((f) => { f.removeAttribute("aria-invalid"); const e = f.parentElement.querySelector(".err"); if (e) e.remove(); });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`); if (!f) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span"); e.className = "err"; e.textContent = msg; f.parentElement.appendChild(e);
    });
  }
  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const g = (k) => (has(raw[k]) ? raw[k] : null);
    const pctIn = (k) => (has(raw[k]) ? raw[k] / 100 : null);
    const h = nopatHelper(g("ebit"), pctIn("tax"));
    const used = g("nopat") !== null ? g("nopat") : h.nopat;
    return { raw, h, used, a: [g("eps"), pctIn("rate"), g("price")], b: [used, pctIn("wacc"), g("debt"), g("equity")] };
  }
  function say(share, label) {
    if (share === null) return "";
    if (share < 0) return `<strong>${label}: PVGO is ${P(share)} of the price.</strong> The price is below what today's earnings are worth if they just stay flat. The paper reads that as low expectations, unless the business is cyclical or in secular decline.`;
    if (share >= 1) return `<strong>${label}: the whole price is PVGO.</strong> Today's earnings explain none of it, usually because they're negative or tiny.`;
    return `<strong>${label}: ${pct(share, 0)} of the price pays for future value creation</strong> and ${pct(1 - share, 0)} for today's earnings held flat.`;
  }

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, h, used, a, b } = read();
    const errors = check(raw);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const A = fromEarnings(...a), B = fromNopat(...b);
    set("h-nopat", num(h.nopat), h.nopat < 0);
    set("b-used", used === null ? "–" : num(used) + (has(raw.nopat) ? "" : " (helper)"), used < 0);
    set("a-sspe", X(A.ssPE)); set("a-pe", X(A.pe)); set("a-ss", num(A.ss), A.ss < 0); set("a-pv", num(A.pvgo), A.pvgo < 0);
    set("a-sh", P(A.share), A.share < 0); set("a-ssh", P(A.ssShare));
    set("b-ev", num(B.ev), B.ev < 0); set("b-eq", num(B.ssEq), B.ssEq < 0); set("b-pv", num(B.pvgo), B.pvgo < 0);
    set("b-sh", P(B.share), B.share < 0); set("b-ssh", P(B.ssShare));
    [["a", A], ["b", B]].forEach(([m, R]) => R.sens.forEach(([r, s], i) => { set(`${m}-r${i}`, P(r, 2)); set(`${m}-s${i}`, P(s), s < 0); }));
    const parts = [say(A.share, "From earnings"), say(B.share, "From NOPAT")].filter(Boolean);
    if (!parts.length) { verdict.innerHTML = "<p>Fill in either method and the results appear as you type.</p>"; bar.hidden = true; return; }
    const ref = "For reference, PVGO averaged 35% of the S&P 500's price from 1961 to 2025. In the paper, US stocks in the lowest fifth by PVGO % had a median 5-year TSR of 8.7% a year, against 5.0% for the highest fifth.";
    verdict.innerHTML = parts.map((p) => `<p>${p}</p>`).join("") + `<p>${ref}</p>`;
    bar.hidden = false;
    const bits = [A.share !== null ? "PVGO " + P(A.share, 0) + " (earnings)" : "", B.share !== null ? "PVGO " + P(B.share, 0) + " (NOPAT)" : ""].filter(Boolean);
    bar.innerHTML = `<span>${bits.join(" · ")}</span><span>↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "pvgo", result: bits.join(" "), source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }
  function values() {
    const v = {};
    const co = $("f-co").value.trim(); if (co) v.co = co;
    fields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.k] = f.value.replace(/[\s,%]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", () => render("typing"));
  fields.forEach((f) => f.addEventListener("blur", () => render("blur")));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { $("stickybar").classList.toggle("away", e.isIntersecting); }).observe($("verdict"));
  }
  window.calcLink = () => shareUrl(values());
  $("share-link").addEventListener("click", () => {
    const url = shareUrl(values());
    try { history.replaceState(null, "", url); } catch (e) { /* sandboxed preview */ }
    copyText(url).then(() => {
      const bt = $("share-link"); bt.textContent = "Link copied";
      setTimeout(() => { bt.textContent = "Copy link to this calculation"; }, 2000);
    }).catch(() => {});
    track("share_calculation", { tool: "pvgo" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = ""; });
    $("f-co").value = "";
    form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });
    render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  const q = readQuery();
  if (q.co) $("f-co").value = q.co;
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  if (["ebit", "tax"].some((k) => q[k] !== undefined)) form.querySelector("details.helper").open = true;
  render(Object.keys(q).length ? "link" : "typing");
}
