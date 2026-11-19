// What to pay for quality: The Compounders (Dybvad, Nyland, Hadžiefendić), chapter 13.
// Same arithmetic as Pay_For_Quality_Template.xlsx; the cell of each line is noted.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const DEFAULTS = { r: 0.095, k: 0.08, hy: 20 };
export const KEY_FIELDS = ["ro", "g"];
export const ROICS = [0.095, 0.12, 0.16, 0.18, 0.22];
export const GROWTHS = [0.05, 0.06, 0.08];
export const ROES = [0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.24, 0.26, 0.28, 0.30];
export const RRS = [0.6, 0.7, 0.8];

// Value of $1 of next year's earnings. n = null: growth forever (the book). Null when undefined.
export function value(r, R, g, n) {
  if (!(R > 0) || !(r > 0)) return null;
  if (n === null) return g >= r ? null : (1 - g / R) / (r - g);
  const s = Math.abs(g - r) < 1e-12 ? n / (1 + r) : (1 - Math.pow((1 + g) / (1 + r), n)) / (r - g);
  return (1 - g / R) * s + Math.pow(1 + g, n) / (r * Math.pow(1 + r, n));
}
export function premium(r, R, g, n) { const v = value(r, R, g, n); return v === null ? null : v * r - 1; }

// Fair P/E: dividends plus a sale at the exit P/E, discounted at the target return k.
export function fairPE(rr, roe, k, years, exitPE) {
  const g = rr * roe, x = exitPE > 0 ? exitPE : 1 / k, q = (1 + g) / (1 + k);
  const div = (1 - rr) * (Math.abs(q - 1) < 1e-12 ? years : q * (1 - Math.pow(q, years)) / (1 - q));
  const sale = x * Math.pow(q, years);
  return { g, exit: x, div, sale, pe: div + sale, eN: Math.pow(1 + g, years) };
}

export function compute(x) {
  const vng = 1 / x.r;                                                  // Premium!C11
  const v = value(x.r, x.ro, x.g, x.n);                                 // C12
  const mult = v === null ? null : v / vng;                             // C13
  const prem = mult === null ? null : mult - 1;                         // C14
  const fromGrowth = mult !== null && mult > 0 ? 1 - 1 / mult : null;   // C15
  const reinv = x.ro > 0 ? x.g / x.ro : null;                           // C16
  const jpe = x.mpe > 0 && mult !== null ? x.mpe * mult : null;         // C22
  const paying = x.mpe > 0 && x.cpe > 0 ? x.cpe / x.mpe - 1 : null;     // C23
  const room = jpe !== null && x.cpe > 0 ? jpe / x.cpe - 1 : null;      // C24
  const matrix = x.growths.map((g) => x.roics.map((R) => (g === null || R === null ? undefined : premium(x.r, R, g, x.n))));
  let fair = null, grid = null;
  if (x.rr !== null && x.roe !== null && x.hy >= 1) {
    fair = fairPE(x.rr, x.roe, x.k, x.hy, x.xpe);                       // Fair PE!C12:C17
    fair.vs = x.fpe2 > 0 ? fair.pe / x.fpe2 - 1 : null;                   // C19
  }
  if (x.hy >= 1) grid = x.rrs.map((rr) => x.roes.map((roe) => (rr === null || roe === null ? undefined : fairPE(rr, roe, x.k, x.hy, x.xpe).pe)));
  return { vng, v, mult, prem, fromGrowth, reinv, jpe, paying, room, matrix, fair, grid };
}

export function check(x, res, raw, signed) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
    else if (v !== null && v < 0 && !signed.has(k)) errors.push([k, "Can't be negative."]);
  }
  for (const k of KEY_FIELDS) if (raw[k] === null) errors.push([k, "Needed for the calculation."]);
  if (raw.r === 0) errors.push(["r", "The cost of capital can't be zero."]);
  if (raw.ro === 0) errors.push(["ro", "Can't be zero."]);
  if (raw.n !== null && (raw.n < 1 || raw.n > 100 || Math.round(raw.n) !== raw.n)) errors.push(["n", "A whole number of years, 1 to 100, or blank for forever."]);
  if (raw.n === null && raw.g !== null && x.g >= x.r) errors.push(["g", "Forever, growth has to be below the cost of capital. Lower it or set the years it lasts."]);
  if (raw.hy !== null && (raw.hy < 1 || raw.hy > 60 || Math.round(raw.hy) !== raw.hy)) errors.push(["hy", "A whole number of years, 1 to 60."]);
  if (raw.k === 0) errors.push(["k", "The target return can't be zero."]);
  if (raw.rr !== null && raw.rr > 100) errors.push(["rr", "Can't be above 100%."]);
  if (errors.length || !res) return { errors, warnings };
  if (x.ro < x.r) warnings.push(`New capital earns ${pct(x.ro, 1)}, below the ${pct(x.r, 1)} cost of capital. Here growth destroys value: the faster it grows, the less it's worth.`);
  if (x.n === null && x.g > 0.06) warnings.push("Growth above about 6% forever is more than the economy can carry. Set the years it lasts for a stricter number.");
  if (x.ro > 0.4) warnings.push("A return on new capital above 40% rarely lasts. Check it's what the company earns on the capital it adds, and not on the capital it already has.");
  if (res.reinv !== null && res.reinv > 1) warnings.push("To grow that fast at that return, the company has to reinvest more than it earns. It would need debt or new shares.");
  if (res.fair && res.fair.g > 0.25) warnings.push(`Earnings growth of ${pct(res.fair.g, 1)} a year for ${x.hy} years is very rare. The fair P/E rests entirely on it.`);
  return { errors, warnings };
}

const x1 = (v) => (v === null || v === undefined ? "n/m" : v.toFixed(2) + "x");
const pe1 = (v) => (v === null || v === undefined ? "n/m" : v.toFixed(1) + "x");

export function interpret(x, res) {
  const horizon = x.n === null ? "if it lasts forever, as the book assumes" : `if it lasts ${x.n} year${x.n === 1 ? "" : "s"}`;
  if (x.ro < x.r) return `Growth of ${pct(x.g, 1)} a year at a ${pct(x.ro, 1)} return on new capital is worth ${x1(res.mult)} a business with no growth ${horizon}: less, because new capital earns below its ${pct(x.r, 1)} cost.`;
  let s = `A business that grows ${pct(x.g, 1)} a year and earns ${pct(x.ro, 1)} on new capital is worth ${x1(res.mult)} one with no growth ${horizon}. That's a premium of ${pct(res.prem)} over the market multiple, and ${pct(res.fromGrowth)} of the value comes from growth.`;
  if (res.jpe !== null) s += ` At a market P/E of ${pe1(x.mpe)}, it justifies ${pe1(res.jpe)}` + (res.room !== null ? `; the company trades at ${pe1(x.cpe)}.` : ".");
  return s;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("cpform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const signed = new Set(fields.filter((f) => f.dataset.signed).map((f) => f.dataset.k));
  const ok = (v) => v !== null && !Number.isNaN(v);

  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const x = {};
    fields.forEach((f) => {
      const k = f.dataset.k, kind = f.dataset.kind;
      x[k] = ok(raw[k]) ? (kind === "percent" ? raw[k] / 100 : raw[k]) : null;
    });
    for (const [k, d] of Object.entries(DEFAULTS)) if (x[k] === null) x[k] = d;
    x.n = ok(raw.n) ? raw.n : null;
    ["mpe", "cpe", "xpe", "fpe2"].forEach((k) => { if (x[k] === null) x[k] = 0; });
    x.roics = [1, 2, 3, 4, 5].map((i) => x["mc" + i]);
    x.growths = [1, 2, 3, 4, 5].map((i) => x["mg" + i]);
    x.roes = ROES.map((_, i) => x["fe" + (i + 1)]);
    x.rrs = [1, 2, 3].map((i) => x["fr" + i]);
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
  const clearAll = () => form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); o.closest("td") && o.closest("td").classList.remove("hit"); });

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x } = read();
    const pre = check(x, null, raw, signed);
    showErrors(pre.errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");
    if (pre.errors.length) {
      clearAll(); warn.hidden = true; bar.hidden = true;
      const missing = pre.errors.some(([, m]) => m.startsWith("Needed"));
      verdict.innerHTML = `<p>${missing ? "Fill in the fields marked * and the results appear as you type." : "Fix the fields marked above."}</p>`;
      return;
    }
    const res = compute(x);
    const { warnings } = check(x, res, raw, signed);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";

    set("o-vng", res.vng.toFixed(2));
    set("o-v", res.v === null ? "n/m" : res.v.toFixed(2));
    set("o-mult", x1(res.mult));
    set("o-prem", res.prem === null ? "n/m" : pct(res.prem), res.prem !== null && res.prem < 0);
    set("o-fg", res.fromGrowth === null ? "n/m" : pct(res.fromGrowth), res.fromGrowth !== null && res.fromGrowth < 0);
    set("o-reinv", res.reinv === null ? "n/m" : pct(res.reinv));
    set("o-jpe", res.jpe === null ? "–" : pe1(res.jpe));
    set("o-paying", res.paying === null ? "–" : pct(res.paying), res.paying !== null && res.paying < 0);
    set("o-room", res.room === null ? "–" : pct(res.room), res.room !== null && res.room < 0);
    res.matrix.forEach((row, i) => row.forEach((v, j) => {
      const id = `pm${i + 1}${j + 1}`;
      set(id, v === undefined ? "" : v === null ? "n/m" : pct(v), v !== null && v !== undefined && v < 0);
      const td = $(id) && $(id).closest("td");
      if (td) td.classList.toggle("hit", x.growths[i] !== null && x.roics[j] !== null && Math.abs(x.growths[i] - x.g) < 1e-9 && Math.abs(x.roics[j] - x.ro) < 1e-9);
    }));
    const f = res.fair;
    set("o-fgr", f ? pct(f.g, 2) : "–");
    set("o-fx", f ? pe1(f.exit) : "–");
    set("o-fdiv", f ? f.div.toFixed(2) : "–");
    set("o-fsale", f ? f.sale.toFixed(2) : "–");
    set("o-fpe", f ? pe1(f.pe) : "Fill in reinvestment and ROE");
    set("o-fen", f ? f.eN.toFixed(2) : "–");
    set("o-fvs", f && f.vs !== null ? pct(f.vs) : "–", f && f.vs !== null && f.vs < 0);
    if (res.grid) res.grid.forEach((row, i) => row.forEach((v, j) => {
      const id = `fp${i + 1}${j + 1}`;
      set(id, v === undefined ? "" : Math.round(v).toString());
      const td = $(id) && $(id).closest("td");
      if (td) td.classList.toggle("hit", !!f && x.rrs[i] !== null && x.roes[j] !== null && Math.abs(x.rrs[i] - x.rr) < 1e-9 && Math.abs(x.roes[j] - x.roe) < 1e-9);
    }));

    const tag = x.ro < x.r ? ["Growth destroys value", " fail"] : Math.abs(x.ro - x.r) < 1e-9 ? ["Growth adds nothing", ""] : [`Premium of ${pct(res.prem)}`, ""];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, res)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>Worth ${x1(res.mult)} no growth</span><span>${f ? "Fair P/E " + pe1(f.pe) + " " : ""}↓</span>`;

    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "compounders", result: tag[0], source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
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
      const b = $("share-link"); b.textContent = "Link copied";
      setTimeout(() => { b.textContent = "Copy link to this calculation"; }, 2000);
    }).catch(() => {});
    track("share_calculation", { tool: "compounders" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    showErrors([]); clearAll(); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });

  const q = readQuery();
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  render(Object.keys(q).length ? "link" : "typing");
}
