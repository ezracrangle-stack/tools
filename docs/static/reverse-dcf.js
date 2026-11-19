// Reverse DCF, retail version of Mauboussin & Rappaport, Expectations Investing (2021), chapters 2, 3 and 5.
// Same arithmetic as Reverse_DCF_Template.xlsx; the cell of each line is noted.
import { parseNumber, perShare, amount, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const NY = 30;
export const DEFAULTS = { t: 0.21, r: 0.09, cg: 0.02, n: 10 };
export const KEY_FIELDS = ["sh", "p", "s0", "g", "m", "inv"];

// Value per share in each year 0..30 (row 54 of the template).
function table(x) {
  const rows = [];
  let S = x.s0, prev = x.s0, cum = 0;
  for (let i = 0; i <= NY; i++) {
    if (i > 0) { prev = S; S = S * (1 + x.g); }                      // row 40
    const op = S * x.m, tax = op * x.t, nopat = op - tax;             // rows 41-43
    const invest = i === 0 ? 0 : (S - prev) * x.inv;                  // row 44
    const fcf = i === 0 ? 0 : nopat - invest;                         // row 45
    const df = 1 / Math.pow(1 + x.r, i);                              // row 46
    cum += fcf * df;                                                  // rows 47-48
    const pvcv = x.r > x.cg ? nopat * (1 + x.cg) / (x.r - x.cg) * df : 0; // row 49
    const corp = cum + pvcv;                                          // row 50
    const eq = corp + x.cash - x.debt;                                // row 53
    rows.push({ year: i, sales: S, nopat, invest, fcf, pv: fcf * df, cum, pvcv, corp, eq, ps: x.sh > 0 ? eq / x.sh : 0 });
  }
  return rows;
}

// Closed form of the same DCF at growth g after N years, minus the price (Solver sheet).
export function gap(x, g, N) {
  if (!(x.sh > 0)) return 0;
  const nm = x.m * (1 - x.t), q = (1 + g) / (1 + x.r);
  const K = x.s0 * ((1 + g) * nm - x.inv * g) / (1 + g);
  const s = Math.abs(q - 1) < 1e-12 ? K * N : K * q * (1 - Math.pow(q, N)) / (1 - q);
  const cv = x.s0 * Math.pow(1 + g, N) * nm * (1 + x.cg) / (x.r - x.cg) / Math.pow(1 + x.r, N);
  return (s + cv + x.cash - x.debt) / x.sh - x.p;
}

// Bisection, 60 steps between -50% and +100% (Solver!C13:G72). Null when no rate gets there.
export function impliedGrowth(x, N) {
  const ok = x.p > 0 && x.sh > 0 && x.s0 > 0 && x.r > x.cg && N >= 1;
  const flo = gap(x, -0.5, N), fhi = gap(x, 1, N);
  if (!ok || flo * fhi > 0) return null;
  let lo = -0.5, hi = 1, mid = 0;
  for (let k = 0; k < 60; k++) {
    mid = (lo + hi) / 2;
    if (k === 59) break;
    const fl = gap(x, lo, N), fm = gap(x, mid, N);
    if (Math.sign(fm) === Math.sign(fl)) lo = mid; else hi = mid;
  }
  return mid;
}

export function compute(x) {
  const rows = table(x);
  const ps = rows.map((r) => r.ps);
  const mcap = x.sh * x.p;                                              // C23
  const ev = mcap + x.debt - x.cash;                                    // C24
  const v0 = ps[0];                                                     // C25
  let first = null;
  for (let i = 0; i <= NY; i++) if (ps[i] >= x.p) { first = i; break; } // row 56
  const yrs = first === null ? null : first === 0 ? 0 : first - 1 + (x.p - ps[first - 1]) / (ps[first] - ps[first - 1]); // C26
  const vyr = yrs === null ? null : ps[Math.round(yrs)];               // C27 (Excel ROUND: halves go up)
  const tm = x.m !== 0 && x.g > -1 && x.t < 1                           // C28
    ? x.m * (1 + x.cg) / (1 + x.g) + (x.g / (1 + x.g)) * x.inv * (x.r - x.cg) / ((1 - x.t) * (1 + x.r)) : null;
  let grow = null;                                                      // C29
  if (tm !== null) grow = x.g <= x.cg ? "untested" : x.m > tm + 0.00005 ? "yes" : x.m < tm - 0.00005 ? "no" : "zero";
  const ig = impliedGrowth(x, x.n);                                     // C34 = Solver!C8
  return { rows, ps, mcap, ev, v0, yrs, vyr, tm, grow, ig };
}

// History sheet: last 4 years of sales, 3 of the rest. Arrays oldest first; null = blank.
export function helperHistory(h) {
  const n = (v) => v || 0, cnt = (a) => a.filter((v) => v !== null && v !== undefined).length, sum = (a) => a.reduce((s, v) => s + n(v), 0);
  const [s3, s2, s1, s0] = h.sales;
  const hg = n(s3) > 0 && n(s0) > 0 ? Math.pow(s0 / s3, 1 / 3) - 1 : null;                         // C16
  const rs = [s2, s1, s0];
  const hm = sum(rs) > 0 && cnt(h.oi) > 0 ? sum(h.oi) / sum(rs) : null;                              // C17
  let hinv = null;                                                                                   // C18
  if (cnt(h.sales) === 4) hinv = s0 - s3 > 0 && cnt(h.capex) > 0 ? (sum(h.capex) - sum(h.da) + sum(h.wc)) / (s0 - s3) : "n/m";
  const ht = sum(h.pti) > 0 && cnt(h.tax) > 0 ? sum(h.tax) / sum(h.pti) : null;                      // C19
  return { hg, hm, hinv, ht };
}

// WACC sheet.
export function helperWacc(rf, beta, erp, kd, tax, w) {
  const ke = rf !== null && beta !== null && erp !== null ? rf + beta * erp : null;   // C8
  const kda = kd !== null && tax !== null ? kd * (1 - tax) : null;                      // C12
  const wacc = ke !== null && kda !== null && w !== null ? (1 - w) * ke + w * kda : null; // C15
  return { ke, kda, wacc };
}

export function check(x, res, raw, signed) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
    else if (v !== null && v < 0 && !signed.has(k)) errors.push([k, "Can't be negative."]);
  }
  for (const k of KEY_FIELDS) if (raw[k] === null) errors.push([k, "Needed for the calculation."]);
  if (raw.sh === 0) errors.push(["sh", "Shares can't be zero."]);
  if (raw.p === 0) errors.push(["p", "Price can't be zero."]);
  if (raw.s0 === 0) errors.push(["s0", "Sales can't be zero."]);
  if (raw.t !== null && raw.t >= 100) errors.push(["t", "Has to be below 100%."]);
  if (raw.g !== null && raw.g <= -50) errors.push(["g", "Has to be above −50%."]);
  if (x.r <= x.cg) errors.push(["cg", "Has to be below the discount rate, or the value is infinite."]);
  if (raw.n !== null && (raw.n < 1 || raw.n > 50 || Math.round(raw.n) !== raw.n)) errors.push(["n", "A whole number of years, 1 to 50."]);
  if (errors.length || !res) return { errors, warnings };

  if (x.m <= 0) warnings.push("With an operating margin of zero or below, the business makes no profit to discount. The numbers below won't mean much.");
  if (res.grow === "no") warnings.push(`Your margin is below the ${pct(res.tm, 1)} threshold, so at your numbers growth destroys value: every extra point of growth lowers it. The years and the implied growth below read backwards.`);
  if (x.cg > 0.04) warnings.push("Growth above inflation forever is rare. The book uses it very sparingly.");
  if (x.r > 0.15) warnings.push("A discount rate above 15% is very high for a listed company. Check it's what you mean.");
  if (x.r < 0.06) warnings.push("A discount rate below 6% gives very long implied periods. Try one point higher before you decide.");
  if (x.g > 0.25) warnings.push("Sales growth above 25% a year, kept up for a decade or more, is very rare.");
  if (x.inv > 1.5) warnings.push("Reinvesting more than $1.50 per dollar of new sales is a lot. Check capex, depreciation and working capital.");
  const big = Math.max(x.s0, Math.abs(res.ev));
  if (big > 0 && (res.mcap / big > 200 || res.mcap / big < 0.005)) warnings.push("Market value and sales are more than 200 times apart. That usually means the units for amounts or shares are off.");
  return { errors, warnings };
}

export function interpret(x, res, cur) {
  const ps = (v) => perShare(v, cur, x.p);
  if (res.yrs === 0) return `At your numbers the business is worth ${ps(res.v0)} a share with no advantage at all, above the ${ps(x.p)} price. The market expects it to do worse than you do.`;
  const years = res.yrs === null ? `more than ${NY} years` : `about ${Math.round(res.yrs)} year${Math.round(res.yrs) === 1 ? "" : "s"}`;
  const range = res.yrs === null ? " That's very long: either your numbers are too low or the price is very high."
    : res.yrs <= 5 ? " That's short: the price assumes the edge fades fast."
    : res.yrs <= 15 ? " That's in the usual range for US stocks, 5 to 15 years."
    : " That's long: the price bets on an edge that lasts.";
  const g = res.ig === null ? "" : ` If the advantage lasts ${x.n} years, the price needs sales growth of ${pct(res.ig, 1)} a year, against your ${pct(x.g, 1)}.`;
  return `At ${ps(x.p)}, and with your numbers, the price assumes ${years} of returns above your discount rate.${range}${g}`;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("rdform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const signed = new Set(fields.filter((f) => f.dataset.signed).map((f) => f.dataset.k));
  const settings = ["cur", "u", "su"];
  const fmtInput = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  const ok = (v) => v !== null && !Number.isNaN(v);
  let hist = { hg: null };

  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const u = Number($("u").value), su = Number($("su").value);
    const x = {};
    fields.forEach((f) => {
      const k = f.dataset.k, kind = f.dataset.kind, v = ok(raw[k]) ? raw[k] : 0;
      x[k] = kind === "money" ? v * u : kind === "shares" ? v * su : kind === "percent" ? v / 100 : v;
    });
    for (const [k, d] of Object.entries(DEFAULTS)) if (raw[k] === null) x[k] = d;
    return { raw, x, u, cur: $("cur").value };
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
  function set(id, text, neg) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("neg", !!neg);
  }
  const clearAll = () => {
    form.querySelectorAll("output").forEach((o) => { if (o.closest(".helper")) return; o.textContent = "–"; o.classList.remove("neg"); });
    $("yt-body").innerHTML = ""; $("yt").hidden = true;
  };
  const pts = (v) => (v >= 0 ? "+" : "−") + Math.abs(100 * v).toFixed(1) + " pts";

  function drawTable(res, x, u, cur) {
    const last = Math.min(NY, Math.max(10, res.yrs === null ? NY : Math.ceil(res.yrs) + 2));
    const hit = res.yrs === null ? -1 : Math.round(res.yrs);
    $("yt-body").innerHTML = res.rows.slice(0, last + 1).map((r) =>
      `<tr${r.year === hit ? ' class="hit"' : ""}><th scope="row">${r.year}</th><td>${amount(r.sales, u)}</td><td>${amount(r.nopat, u)}</td><td>${r.year ? amount(r.fcf, u) : "–"}</td><td>${perShare(r.ps, cur, x.p)}</td></tr>`).join("");
    $("yt").hidden = false;
  }

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x, u, cur } = read();
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

    const ps = (v) => perShare(v, cur, x.p);
    set("o-mcap", amount(res.mcap, u));
    set("o-ev", amount(res.ev, u), res.ev < 0);
    set("o-v0", ps(res.v0), res.v0 < 0);
    set("o-yrs", res.yrs === null ? `More than ${NY}` : res.yrs.toFixed(1));
    set("o-vyr", res.vyr === null ? "–" : ps(res.vyr));
    set("o-tm", res.tm === null ? "n/m" : pct(res.tm, 2));
    set("x-grow", { yes: "Yes", no: "No", zero: "Adds nothing", untested: "Not tested" }[res.grow] || "–");
    set("o-ig", res.ig === null ? "None between −50% and 100%" : pct(res.ig, 1), res.ig !== null && res.ig < 0);
    set("o-igb", res.ig === null ? "–" : pts(res.ig - x.g));
    set("o-igh", res.ig === null || hist.hg === null ? "–" : pts(res.ig - hist.hg));
    drawTable(res, x, u, cur);

    const tag = res.yrs === null ? ["More than 30 years", " fail"] : res.yrs === 0 ? ["Below no-advantage value", ""]
      : res.yrs <= 5 ? ["Short implied period", ""] : res.yrs <= 15 ? ["Usual implied period", ""] : ["Long implied period", " fail"];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, res, cur)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>${res.yrs === null ? "30+ years" : res.yrs.toFixed(1) + " years"}</span><span>${res.ig === null ? "" : "Growth " + pct(res.ig, 1) + " "}↓</span>`;

    const sig = JSON.stringify([raw, $("u").value, $("su").value]);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "reverse-dcf", result: tag[0], source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  // ── Helpers ──
  const hfields = [...form.querySelectorAll("input[data-h]")];
  const hv = (k) => { const el = form.querySelector(`input[data-h="${k}"]`); const v = el ? parseNumber(el.value) : null; return ok(v) ? v : null; };
  const writePct = (k, v) => { $("f-" + k).value = String(Math.round(v * 10000) / 100); };
  function runHelpers(changed) {
    const yrs = (p) => [1, 2, 3].map((i) => hv(p + i));
    const H = helperHistory({ sales: [0, 1, 2, 3].map((i) => hv("hs" + i)), oi: yrs("hoi"), capex: yrs("hcx"), da: yrs("hda"), wc: yrs("hwc"), tax: yrs("htx"), pti: yrs("hpt") });
    hist = H;
    set("h-g", H.hg === null ? "–" : pct(H.hg, 1));
    set("h-m", H.hm === null ? "–" : pct(H.hm, 1));
    set("h-inv", H.hinv === null ? "–" : H.hinv === "n/m" ? "n/m" : pct(H.hinv, 1));
    set("h-t", H.ht === null ? "–" : pct(H.ht, 1));
    if (changed === "H") {
      if (H.hg !== null) writePct("g", H.hg);
      if (H.hm !== null) writePct("m", H.hm);
      if (typeof H.hinv === "number" && H.hinv >= 0) writePct("inv", H.hinv);
      if (H.ht !== null) writePct("t", H.ht);
    }
    const pv = (k) => { const v = hv(k); return v === null ? null : v / 100; };
    const W = helperWacc(pv("wrf"), hv("wb"), pv("werp"), pv("wkd"), pv("wtx"), pv("ww"));
    set("h-ke", W.ke === null ? "–" : pct(W.ke, 2));
    set("h-kd", W.kda === null ? "–" : pct(W.kda, 2));
    set("h-wacc", W.wacc === null ? "–" : pct(W.wacc, 2));
    if (changed === "W" && W.wacc !== null) writePct("r", W.wacc);
  }
  hfields.forEach((f) => {
    const group = f.dataset.h.startsWith("w") ? "W" : "H";
    f.addEventListener("input", (ev) => { ev.stopPropagation(); runHelpers(group); render("typing"); });
    f.addEventListener("blur", () => { const v = parseNumber(f.value); if (ok(v) && Math.abs(v) >= 1000) f.value = fmtInput(v); });
  });

  function values() {
    const v = {};
    settings.forEach((k) => { v[k] = $(k).value; });
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    hfields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.h] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (ev) => { if (ev.target.dataset && ev.target.dataset.h) return; render("typing"); });
  settings.forEach((k) => $(k).addEventListener("change", () => render("typing")));
  fields.forEach((f) => f.addEventListener("blur", () => {
    const v = parseNumber(f.value);
    if (ok(v) && Math.abs(v) >= 1000) f.value = fmtInput(v);
    render("blur");
  }));
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
    track("share_calculation", { tool: "reverse-dcf" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    hfields.forEach((f) => { f.value = ""; });
    showErrors([]); clearAll(); runHelpers(); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });

  const q = readQuery();
  if (Object.keys(q).length) {
    settings.forEach((k) => { if (q[k] && [...$(k).options].some((o) => o.value === q[k])) $(k).value = q[k]; });
    fields.forEach((f) => {
      if (q[f.dataset.k] === undefined) return;
      const v = parseNumber(q[f.dataset.k]);
      f.value = ok(v) && Math.abs(v) >= 1000 ? fmtInput(v) : q[f.dataset.k];
    });
    hfields.forEach((f) => { if (q[f.dataset.h] !== undefined) { f.value = q[f.dataset.h]; f.closest("details").open = true; } });
    runHelpers(); render("link");
  } else { runHelpers(); render("typing"); }
}
