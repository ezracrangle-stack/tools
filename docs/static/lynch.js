// Peter Lynch's P/E vs growth: One Up on Wall Street, chapter 13 "Some Famous Numbers".
// Same arithmetic as Lynch_PE_Growth_Template.xlsx; the cell of each line is noted.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const DEFAULTS = { yrs: 10 };
export const KEY_FIELDS = ["price", "eps", "g"];

export function pegReading(peg) {
  if (peg === null) return null;
  return peg <= 0.5 ? "very positive" : peg < 0.9 ? "below growth" : peg <= 1.1 ? "fair" : peg < 2 ? "pricey" : "very negative";
}
export function divReading(d) {
  if (d === null) return null;
  return d < 1 ? "poor" : d < 1.5 ? "between" : d < 2 ? "okay" : "looking for";
}

export function compute(x) {
  const ok = x.price > 0 && x.eps > 0;
  const pe = ok ? x.price / x.eps : null;                                          // C12
  const yld = x.price > 0 ? (x.dps || 0) / x.price : null;                         // C13
  const gpts = x.g * 100;
  const peg = pe !== null && x.g > 0 ? pe / gpts : null;                           // C14
  const divr = pe !== null && yld !== null ? (gpts + yld * 100) / pe : null;      // C16
  const hasCash = x.cash !== null;
  const peX = pe !== null && hasCash && x.price - x.cash > 0 ? (x.price - x.cash) / x.eps : null; // C18
  const pegX = peX !== null && x.g > 0 ? peX / gpts : null;                        // C19
  const divX = peX !== null && yld !== null ? (gpts + yld * 100) / peX : null;    // C20
  const fair = x.eps > 0 && x.g > 0 ? gpts * x.eps : null;                         // C21
  const fairCash = fair !== null && hasCash ? fair + x.cash : null;                // C22
  const upside = fair !== null && x.price > 0 ? (fairCash !== null ? fairCash : fair) / x.price - 1 : null; // C23
  const epsN = x.eps > 0 && x.yrs > 0 ? x.eps * Math.pow(1 + x.g, x.yrs) : null;  // C28
  const peUsed = x.peEnd > 0 ? x.peEnd : pe;                                       // C29
  const priceN = epsN !== null && peUsed !== null ? epsN * peUsed : null;          // C30
  const multN = priceN !== null && x.price > 0 ? priceN / x.price : null;          // C31
  const yearN = multN !== null && multN > 0 ? Math.pow(multN, 1 / x.yrs) - 1 : null; // C32
  return { pe, yld, peg, pegR: pegReading(peg), divr, divR: divReading(divr), peX, pegX, divX, fair, fairCash, upside, epsN, peUsed, priceN, multN, yearN };
}

// Growth helper: EPS from Year 1 with no gaps.
export function helperGrowth(eps) {
  const n = eps.filter((v) => v !== null).length;                                  // C9
  const first = eps[0] !== null ? eps[0] : null, last = n > 0 ? (eps[n - 1] === null ? 0 : eps[n - 1]) : null; // C10, C11 (INDEX by count; a gap reads as 0)
  const yrs = n >= 2 ? n - 1 : null;                                               // C12
  const cagr = yrs && yrs > 0 && first > 0 && last > 0 ? Math.pow(last / first, 1 / yrs) - 1 : null; // C13
  const changes = eps.slice(1).map((v, i) => (eps[i] !== null && v !== null && eps[i] > 0 ? v / eps[i] - 1 : null)); // row 7
  return { n, first, last, yrs, cagr, changes };
}

export function check(x, res, raw) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (const k of KEY_FIELDS) if (raw[k] === null) errors.push([k, "Needed for the calculation."]);
  if (raw.price !== null && raw.price <= 0) errors.push(["price", "Has to be above zero."]);
  if (raw.eps !== null && raw.eps <= 0) errors.push(["eps", "With no earnings there's no P/E. Lynch would put this in another category (a turnaround, maybe)."]);
  if (raw.dps !== null && raw.dps < 0) errors.push(["dps", "Can't be negative."]);
  if (raw.yrs !== null && (raw.yrs < 1 || raw.yrs > 40 || Math.round(raw.yrs) !== raw.yrs)) errors.push(["yrs", "A whole number of years, 1 to 40."]);
  if (raw.peEnd !== null && raw.peEnd < 0) errors.push(["peEnd", "Can't be negative."]);
  if (errors.length || !res) return { errors, warnings };
  if (x.g <= 0) warnings.push("With no growth the PEG means nothing. For slow growers Lynch looks at the dividend instead: the dividend-adjusted ratio still works.");
  if (x.g > 0.5) warnings.push("Growth of 50% to 100% a year: Lynch says to be suspicious. Those companies are usually in hot industries.");
  else if (x.g > 0.25) warnings.push("Lynch is wary of companies growing faster than 25% a year. His favorites grow 20% to 25%.");
  if (x.cash !== null && x.cash > x.price) warnings.push("Net cash is more than the share price: the market values the business at less than nothing. Check the cash isn't trapped or about to be spent.");
  if (x.g > 0 && x.g < 0.05 && res.yld !== null && res.yld === 0) warnings.push("A slow grower that pays no dividend: Lynch's measures don't flatter it, and that's the point.");
  return { errors, warnings };
}

const pe1 = (v) => (v === null ? "–" : v.toFixed(1) + "x");
const n2 = (v) => (v === null ? "–" : v.toFixed(2));

export function interpret(x, res) {
  if (res.peg === null) return `The P/E is ${pe1(res.pe)}. With growth of ${pct(x.g, 1)} the PEG means nothing; the dividend-adjusted ratio is ${n2(res.divr)}.`;
  const rd = { "very positive": "very positive: the P/E is half the growth rate or less", "below growth": "the P/E is below the growth rate, so it may be a bargain",
    fair: "the P/E is about the growth rate, which Lynch calls fairly priced", pricey: "the P/E is above the growth rate: pricey", "very negative": "very negative: the P/E is twice the growth rate or more" }[res.pegR];
  const dv = { poor: "poor", between: "between poor and okay", okay: "okay", "looking for": "what Lynch is looking for" }[res.divR];
  let s = `A P/E of ${pe1(res.pe)} on ${pct(x.g, 1)} growth gives a PEG of ${n2(res.peg)}: ${rd}. With the dividend, the ratio is ${n2(res.divr)}, ${dv}.`;
  if (res.peX !== null) s += ` Without the net cash, the P/E is ${pe1(res.peX)} and the PEG ${n2(res.pegX)}.`;
  return s;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("lyform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const hfields = [...form.querySelectorAll("input[data-h]")];
  const ok = (v) => v !== null && !Number.isNaN(v);
  const money = (v) => (v === null ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  let hist = { cagr: null };

  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const N = (k) => (ok(raw[k]) ? raw[k] : null);
    const x = { price: N("price") || 0, eps: N("eps") || 0, g: N("g") === null ? 0 : N("g") / 100, dps: N("dps") || 0, cash: N("cash"),
      yrs: N("yrs") === null ? DEFAULTS.yrs : N("yrs"), peEnd: N("peEnd") || 0 };
    return { raw, x };
  }
  function showErrors(errors, quiet) {
    fields.forEach((f) => {
      f.removeAttribute("aria-invalid");
      const e = f.parentElement.querySelector(".err");
      if (e) e.remove();
    });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`);
      if (!f || f.getAttribute("aria-invalid")) return;
      if (quiet && f.value.trim() === "" && msg.startsWith("Needed")) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span");
      e.className = "err"; e.textContent = msg;
      f.insertAdjacentElement("afterend", e);
    });
  }
  function set(id, text, neg) { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); }
  const clearAll = () => form.querySelectorAll("output").forEach((o) => { if (o.closest(".helper")) return; o.textContent = "–"; o.classList.remove("neg"); });

  function runHelper(write) {
    const eps = [1, 2, 3, 4, 5, 6].map((i) => { const el = form.querySelector(`input[data-h="he${i}"]`); const v = el ? parseNumber(el.value) : null; return ok(v) ? v : null; });
    const H = helperGrowth(eps);
    hist = H;
    H.changes.forEach((v, i) => set("h-c" + (i + 2), v === null ? "" : pct(v, 1), v !== null && v < 0));
    set("h-cagr", H.cagr === null ? "–" : pct(H.cagr, 1), H.cagr !== null && H.cagr < 0);
    if (write && H.cagr !== null) $("f-g").value = String(Math.round(H.cagr * 1000) / 10);
  }
  hfields.forEach((f) => f.addEventListener("input", (ev) => { ev.stopPropagation(); runHelper(true); render("typing"); }));

  const pegText = { "very positive": "Very positive", "below growth": "Below the growth rate", fair: "About fairly priced", pricey: "Pricey", "very negative": "Very negative" };
  const divText = { poor: "Poor", between: "Between poor and okay", okay: "Okay", "looking for": "What you're looking for" };
  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x } = read();
    const pre = check(x, null, raw);
    showErrors(pre.errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");
    set("o-hg", hist.cagr === null ? "Use the helper" : pct(hist.cagr, 1));
    if (pre.errors.length) {
      clearAll(); warn.hidden = true; bar.hidden = true;
      set("o-hg", hist.cagr === null ? "Use the helper" : pct(hist.cagr, 1));
      const missing = pre.errors.some(([, m]) => m.startsWith("Needed"));
      verdict.innerHTML = `<p>${missing ? "Fill in the fields marked * and the results appear as you type." : "Fix the fields marked above."}</p>`;
      return;
    }
    const res = compute(x);
    const { warnings } = check(x, res, raw);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";
    set("o-pe", pe1(res.pe));
    set("o-yld", res.yld === null ? "–" : pct(res.yld, 2));
    set("o-peg", res.peg === null ? "n/m" : n2(res.peg));
    set("x-pegr", res.pegR ? pegText[res.pegR] : "n/m", res.pegR === "pricey" || res.pegR === "very negative");
    set("o-div", n2(res.divr));
    set("x-divr", res.divR ? divText[res.divR] : "–", res.divR === "poor");
    set("o-pex", res.peX === null ? "–" : pe1(res.peX));
    set("o-pegx", res.pegX === null ? "–" : n2(res.pegX));
    set("o-divx", res.divX === null ? "–" : n2(res.divX));
    set("o-fair", res.fair === null ? "n/m" : money(res.fair));
    set("o-fairc", res.fairCash === null ? "–" : money(res.fairCash));
    set("o-up", res.upside === null ? "–" : pct(res.upside), res.upside !== null && res.upside < 0);
    set("o-epsn", money(res.epsN));
    set("o-peu", pe1(res.peUsed));
    set("o-pricen", money(res.priceN));
    set("o-multn", res.multN === null ? "–" : res.multN.toFixed(2) + "x");
    set("o-yearn", res.yearN === null ? "–" : pct(res.yearN, 1), res.yearN !== null && res.yearN < 0);
    const tag = res.pegR ? [`PEG ${n2(res.peg)}`, res.pegR === "pricey" || res.pegR === "very negative" ? " fail" : ""] : [`P/E ${pe1(res.pe)}`, ""];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, res)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>PEG ${res.peg === null ? "n/m" : n2(res.peg)}</span><span>With dividends ${n2(res.divr)} ↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "lynch", result: res.pegR || "n/m", source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    hfields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.h] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (ev) => { if (ev.target.dataset && ev.target.dataset.h) return; render("typing"); });
  fields.forEach((f) => f.addEventListener("blur", () => render("blur")));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { $("stickybar").classList.toggle("away", e.isIntersecting); }).observe($("verdict"));
  }
  window.calcLink = () => shareUrl(values());
  $("share-link").addEventListener("click", () => {
    const url = shareUrl(values());
    try { history.replaceState(null, "", url); } catch (e) { /* sandboxed preview */ }
    copyText(url).then(() => {
      const b = $("share-link"); b.textContent = "Link copied";
      setTimeout(() => { b.textContent = "Copy link to this calculation"; }, 2000);
    }).catch(() => {});
    track("share_calculation", { tool: "lynch" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    hfields.forEach((f) => { f.value = ""; });
    showErrors([]); clearAll(); runHelper(false); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });

  const q = readQuery();
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  hfields.forEach((f) => { if (q[f.dataset.h] !== undefined) { f.value = q[f.dataset.h]; f.closest("details").open = true; } });
  runHelper(false);
  render(Object.keys(q).length ? "link" : "typing");
}
