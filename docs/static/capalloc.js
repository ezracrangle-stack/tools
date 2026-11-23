// Where the money went. Same arithmetic as Capital_Allocation_Template.xlsx.
// Mauboussin and Callahan, "Capital Allocation: Results, Analysis, and Assessment" (Counterpoint Global, December 2022):
// Exhibit 4 (sources and uses), the checklist's past spending patterns (Rappaport's incremental rates, payout) and Exhibit 40.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const KEYS = ["rev", "ni", "cfo", "nwc", "capex", "da", "acq", "sold", "debtIn", "debtOut", "issued", "buy", "div", "mcap"];
const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const N = (v) => (has(v) ? v : 0);
const sum = (ys, k) => ys.reduce((s, y) => s + N(y[k]), 0);

// years: 5 objects (oldest first) with the KEYS above; rev0 = revenue the year before year 1.
export function compute(years, rev0 = null) {
  const T = Object.fromEntries(KEYS.map((k) => [k, sum(years, k)]));
  const ops = years.reduce((s, y) => s + (has(y.cfo) ? y.cfo + N(y.nwc) : 0), 0);
  const sources = { ops, sold: T.sold, debtIn: T.debtIn, issued: T.issued };
  const srcTot = ops + T.sold + T.debtIn + T.issued;
  const uses = { capex: T.capex, acq: T.acq, nwc: T.nwc, div: T.div, buy: T.buy, debtOut: T.debtOut };
  const useTot = T.capex + T.acq + T.nwc + T.div + T.buy + T.debtOut;
  const share = (o, tot) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, tot > 0 ? x / tot : null]));
  const last = years[years.length - 1] || {};
  const dSales = has(last.rev) && has(rev0) ? last.rev - rev0 : null;
  const rate = (x) => (dSales > 0 ? x / dSales : null);
  const returned = T.div + T.buy - T.issued;
  const net = years.map((y) => (has(y.buy) || has(y.issued) ? N(y.buy) - N(y.issued) : null));
  const yields = years.map((y, i) => (y.mcap > 0 ? (N(y.div) + N(net[i])) / y.mcap : null)).filter((x) => x !== null);
  const range = (a) => (a.length ? Math.max(...a) - Math.min(...a) : null);
  return {
    totals: T, sources, srcTot, srcPct: share(sources, srcTot), uses, useTot, usePct: share(uses, useTot), left: srcTot - useTot,
    selfFunded: srcTot > 0 ? (ops + T.sold) / srcTot : null,
    invested: useTot > 0 ? (T.capex + T.acq + T.nwc) / useTot : null,
    returnedAll: useTot > 0 ? (T.div + T.buy + T.debtOut) / useTot : null,
    dSales, mna: rate(T.acq - T.sold), fixed: rate(T.capex - T.da), wc: rate(T.nwc),
    returned, fromDiv: returned > 0 ? T.div / returned : null, fromBuy: returned > 0 ? (T.buy - T.issued) / returned : null,
    payout: T.ni > 0 ? returned / T.ni : null, net,
    yield: yields.length ? yields.reduce((s, x) => s + x, 0) / yields.length : null,
    divRange: range(years.map((y) => y.div).filter(has)), netRange: range(net.filter((x) => x !== null)),
  };
}

export function check(raw) {
  const errors = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (const [k, v] of Object.entries(raw)) if (has(v) && v < 0 && !k.startsWith("nwc")) errors.push([k, "Enter it as a positive number."]);
  return errors;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("caform")) {
  const form = document.getElementById("caform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const num = (v) => (v === null ? "–" : (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const P = (v) => (v === null ? "–" : (v < 0 ? "−" : "") + pct(Math.abs(v), 1));
  const cents = (v) => Math.round(v * 100) + (Math.abs(Math.round(v * 100)) === 1 ? " cent" : " cents");
  const SRC = ["ops", "sold", "debtIn", "issued"], USE = ["capex", "acq", "nwc", "div", "buy", "debtOut"];

  function read() {
    const raw = {};
    fields.forEach((f) => { if (!f.dataset.text) raw[f.dataset.k] = parseNumber(f.value); });
    const g = (k) => (has(raw[k]) ? raw[k] : null);
    const years = [0, 1, 2, 3, 4].map((i) => Object.fromEntries(KEYS.map((k) => [k, g(k + i)])));
    return { raw, years, rev0: g("rev0x") };
  }
  function showErrors(errors) {
    fields.forEach((f) => { f.removeAttribute("aria-invalid"); const e = (f.closest("td") || f.parentElement).querySelector(".err"); if (e) e.remove(); });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`); if (!f) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span"); e.className = "err"; e.textContent = msg;
      (f.closest("td") || f.parentElement).appendChild(e);
    });
  }
  function set(id, text, neg) { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); }

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, years, rev0 } = read();
    const errors = check(raw);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const r = compute(years, rev0);
    const any = r.srcTot > 0 || r.useTot > 0;
    SRC.forEach((k) => { set("s-" + k, any ? num(r.sources[k]) : "–"); set("sp-" + k, P(r.srcPct[k])); });
    USE.forEach((k) => { set("u-" + k, any ? num(r.uses[k]) : "–", r.uses[k] < 0); set("up-" + k, P(r.usePct[k]), r.usePct[k] < 0); });
    set("s-tot", any ? num(r.srcTot) : "–"); set("u-tot", any ? num(r.useTot) : "–"); set("o-left", any ? num(r.left) : "–", r.left < 0);
    set("o-self", P(r.selfFunded)); set("o-inv", P(r.invested)); set("o-ret", P(r.returnedAll));
    set("o-ds", r.dSales === null ? "–" : num(r.dSales), r.dSales < 0);
    set("o-mna", P(r.mna), r.mna < 0); set("o-fix", P(r.fixed), r.fixed < 0); set("o-wc", P(r.wc), r.wc < 0);
    set("o-sh", any ? num(r.returned) : "–", r.returned < 0); set("o-div", P(r.fromDiv)); set("o-buy", P(r.fromBuy), r.fromBuy < 0);
    set("o-pay", P(r.payout)); set("o-yld", P(r.yield), r.yield < 0);
    set("o-dr", r.divRange === null ? "–" : num(r.divRange)); set("o-nr", r.netRange === null ? "–" : num(r.netRange));
    years.forEach((y, i) => set("n-" + i, r.net[i] === null ? "–" : num(r.net[i]), r.net[i] < 0));

    if (!any) { verdict.innerHTML = "<p>Fill in the years from the cash flow statement and the results appear as you type.</p>"; bar.hidden = true; return; }
    const co = $("f-co").value.trim() || "The company";
    const parts = [];
    if (r.selfFunded !== null) parts.push(`<strong>${co} got ${pct(r.selfFunded, 0)} of its cash from the business itself</strong>${r.selfFunded < 0.995 ? " and the rest from lenders and shareholders" : ""}.`);
    if (r.invested !== null) parts.push(`${pct(Math.max(0, r.invested), 0)} went back into the business and ${pct(Math.max(0, r.returnedAll), 0)} to lenders and shareholders.`);
    if (r.dSales !== null && r.dSales <= 0) parts.push("Sales didn't grow over the period, so there are no incremental rates.");
    else if (r.mna !== null) parts.push(`Each $1 of new sales took ${cents(r.mna)} of acquisitions net of asset sales, ${cents(r.fixed)} of capex above depreciation and ${cents(r.wc)} of working capital.`);
    if (r.payout !== null) parts.push(`It returned ${pct(r.payout, 0)} of its net income to shareholders${r.fromBuy !== null ? `, ${pct(Math.max(0, r.fromBuy), 0)} of it through net buybacks` : ""}.`);
    verdict.innerHTML = `<p>${parts.join(" ")}</p>`;
    bar.hidden = false;
    const bits = [r.selfFunded !== null ? "Self-funded " + pct(r.selfFunded, 0) : "", r.payout !== null ? "Payout " + pct(r.payout, 0) : ""].filter(Boolean);
    bar.innerHTML = `<span>${bits.join(" · ") || "Results"}</span><span>↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "capital-allocation", result: bits.join(" "), source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    const co = $("f-co").value.trim(); if (co) v.co = co;
    fields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.k] = f.dataset.text ? f.value.trim() : f.value.replace(/[\s,]/g, ""); });
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
    track("share_calculation", { tool: "capital-allocation" });
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
  render(Object.keys(q).length ? "link" : "typing");
}
