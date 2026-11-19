// EPV calculator, Phil Oakley's method (How to Pick Quality Shares, ch. 10-11).
// Same formulas as Oakley_EPV_Template.xlsx; the cell of each line is noted.
import { parseNumber, money, perShare, amount, pct, track,
  shareUrl, readQuery, copyText } from "./calc.js";

// Percent inputs are typed as whole numbers (9 = 9%) and arrive here as fractions.
export const DEFAULTS = { tax: 0.25, r: 0.09, ty: 0.10, spr: 0.03, buf: 0.15 };
export const KEY_FIELDS = ["sh", "p", "ebit", "da", "mcx"];
const ONE_OFFS = ["rs", "imp", "iw", "tc", "ls", "gs", "oo"];

// Money arrives in whole currency units, shares in whole shares.
// Blank inputs arrive as 0; ni arrives as null when blank.
export function compute(x) {
  const nebit = x.ebit + ONE_OFFS.reduce((s, k) => s + x[k], 0);   // C22
  const pre = nebit + x.da - x.mcx - x.lease;                       // C28
  const taxAmt = Math.max(0, pre) * x.tax;                          // C30
  const cp = pre - taxAmt;                                          // C31
  const ev = x.r > 0 ? cp / x.r : 0;                                // C35
  const epv = ev - x.debt - x.pen - x.pref - x.mi + x.cash;         // C41
  const epvps = x.sh > 0 ? epv / x.sh : 0;                          // C42
  const epvpct = x.p > 0 ? epvps / x.p : 0;                         // C43
  const grow = x.p > 0 ? 1 - epvpct : 0;                            // C44
  const rule = cp <= 0 ? "negative" : epvpct >= 0.5 ? "pass" : "fail"; // C45
  const upside = x.p > 0 ? epvps / x.p - 1 : 0;                     // C46

  const res = { nebit, pre, taxAmt, cp, ev, epv, epvps, epvpct, grow, rule, upside, hasOE: x.ni !== null };
  if (x.ni === null) return res;

  const oe = x.ni + x.da + x.onc - x.mcx - x.lease;                 // C54
  const shOE = x.wsh > 0 ? x.wsh : x.sh;                            // C11
  const oeps = shOE > 0 ? oe / shOE : 0;                            // C55
  const cy = x.p > 0 ? oeps / x.p : 0;                              // C56
  const p5 = oeps > 0 ? oeps / 0.05 : 0;                            // C57
  const p8 = oeps > 0 ? oeps / 0.08 : 0;                            // C58
  const years = (g) => (cy <= 0 ? null : cy >= x.ty ? 0 : Math.log(x.ty / cy) / Math.log(1 + g)); // C61-63
  const orate = x.infl + x.spr;                                     // C69
  const maxp = oeps > 0 && orate > 0 ? oeps / orate : 0;            // C70
  const bmaxp = oeps > 0 && x.bond > 0 ? oeps / x.bond : 0;         // C71
  const ideal = maxp * (1 - x.buf);                                 // C73
  const cyi = ideal > 0 ? oeps / ideal : 0;                         // C74
  const vsmax = maxp > 0 ? x.p / maxp - 1 : 0;                      // C75
  const sell = maxp <= 0 ? "n/m" : x.p > maxp * 1.25 ? "sell" : "none"; // C76
  return Object.assign(res, { oe, shOE, oeps, cy, p5, p8, y5: years(0.05), y10: years(0.10), y15: years(0.15),
    orate, maxp, bmaxp, ideal, cyi, vsmax, sell });
}

// ── Helpers (Helper A, B and C in the Excel template) ─────────────────────
const avg = (xs) => { const v = xs.filter((n) => n !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };

// Helper A: average EBIT of the years filled (C100), margins where revenue is given.
export function helperEbit(ebits, revenues) {
  const n = ebits.filter((v) => v !== null).length;
  const margins = ebits.map((e, i) => (e !== null && revenues[i] > 0 ? e / revenues[i] : null));
  return { avg: avg(ebits), n, margins };
}

// Helper B: the company's figure, else the higher of the 5- and 10-year averages (C115-C119).
export function helperCapex(reported, capex, da) {
  const a5 = avg(capex.slice(0, 5)), a10 = avg(capex), d120 = 1.2 * da;
  const hasRep = reported !== null && reported > 0;
  const sug = hasRep ? reported : Math.max(a5, a10);
  const method = hasRep ? "Reported by the company" : a5 === 0 && a10 === 0 ? "–" : a10 > a5 ? "10-year average" : "5-year average";
  return { rep: hasRep ? reported : 0, a5, a10, d120, sug, method };
}

// Helper C: normalized net income (C126).
export function helperNI(ni, taxed, untaxed, tax) {
  return ni + taxed * (1 - tax) + untaxed;
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
  if (raw.r === 0) errors.push(["r", "The required return can't be zero."]);
  for (const k of ["tax", "buf"]) if (raw[k] !== null && raw[k] >= 100) errors.push([k, "Below 100."]);
  if (errors.length || !res) return { errors, warnings };

  if (res.cp <= 0) warnings.push("After-tax cash profits are zero or negative, so the EPV doesn't mean anything. Either the business is losing money once maintenance capex is paid, or one of the inputs is off.");
  if (x.mcx < 0.5 * x.da) warnings.push("Maintenance capex is less than half of D&A. Possible for some media and software companies, but check it: it's the number that moves the EPV the most.");
  if (x.r > 0.20) warnings.push("A required return above 20% is very high. Oakley's range for very risky companies starts at 15%.");
  if (x.bond > 0 && x.r < x.bond) warnings.push("Your required return is below the bond yield. A share should pay you more than a government bond.");
  if (x.lease > 0 && x.debt > 0) warnings.push("You deducted lease payments, so make sure the debt figure doesn't include lease liabilities. Otherwise leases count twice.");
  if (x.tax > 0 && x.tax < 0.10) warnings.push("A tax rate under 10% is unusual. Oakley uses the statutory rate when the effective one is lower.");
  if (raw.wsh !== null && x.wsh > 0 && Math.abs(x.wsh / x.sh - 1) > 0.2) warnings.push("Weighted and latest shares differ by more than 20%. Check that both use the same unit.");
  const mcap = x.sh * x.p;
  if (Math.abs(res.ev) > 0 && (mcap / Math.abs(res.ev) > 50 || mcap / Math.abs(res.ev) < 0.02)) warnings.push("Market cap and EPV are more than 50 times apart. That usually means the units for amounts or shares are off.");
  if (res.hasOE) {
    if (res.oe <= 0) warnings.push("Owner earnings are zero or negative, so the cash yield and the maximum price don't mean anything.");
    if (x.infl === 0 && raw.infl === null) warnings.push("Add the inflation rate to get the maximum price.");
    if (x.infl > 0.15) warnings.push("Inflation above 15% makes the maximum price very low. Check the figure and the currency.");
  }
  return { errors, warnings };
}

export function interpret(x, res, cur) {
  const pr = perShare(x.p, cur, x.p);
  if (res.cp <= 0) return "After maintenance capex and tax, the business makes no cash today, so there's no earnings power to value. Look at it again when the cash profits are back.";
  let s;
  const share = pct(res.epvpct), rest = pct(res.grow);
  if (res.epvpct >= 1) s = `Today's cash profits are worth ${perShare(res.epvps, cur, x.p)} a share, more than the ${pr} price. You pay nothing for growth.`;
  else s = `Today's cash profits explain ${share} of the ${pr} price. The other ${rest} is a bet on growth, so it ${res.rule === "pass" ? "clears" : "fails"} Oakley's 50% rule.`;
  if (res.hasOE && res.maxp > 0) {
    const gap = res.vsmax;
    s += ` The cash yield is ${pct(res.cy, 1)} and the maximum price is ${perShare(res.maxp, cur, x.p)}, so the share ${gap > 0 ? `trades ${pct(gap)} above it` : `trades ${pct(-gap)} below it`}.`;
  } else if (res.hasOE) {
    s += ` The cash yield is ${pct(res.cy, 1)}. Add inflation in section 5 to get a maximum price.`;
  }
  return s;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("epvform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const signed = new Set(fields.filter((f) => f.dataset.signed).map((f) => f.dataset.k));
  const settings = ["cur", "u", "su"];
  const fmtInput = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  const ok = (v) => v !== null && !Number.isNaN(v);

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
    x.ni = ok(raw.ni) ? raw.ni * u : null;
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
  const clearAll = () => form.querySelectorAll("output").forEach((o) => {
    if (o.closest(".helper")) return; // helper results stay; they don't depend on the main fields
    o.textContent = "–"; o.classList.remove("neg");
  });

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x, u, cur } = read();
    document.querySelectorAll(".curname").forEach((s) => { s.textContent = cur; });
    const pre = check(x, null, raw, signed);
    showErrors(pre.errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");

    // Normalized EBIT fills in as soon as there's something to add.
    const partial = compute(x);
    set("o-nebit", raw.ebit === null ? "–" : amount(partial.nebit, u), partial.nebit < 0);

    if (pre.errors.length) {
      clearAll();
      set("o-nebit", raw.ebit === null ? "–" : amount(partial.nebit, u), partial.nebit < 0);
      warn.hidden = true; bar.hidden = true;
      const missing = pre.errors.some(([, m]) => m.startsWith("Needed"));
      verdict.innerHTML = `<p>${missing ? "Fill in the fields marked * and the results appear as you type." : "Fix the fields marked above."}</p>`;
      return;
    }
    const res = compute(x);
    const { warnings } = check(x, res, raw, signed);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";

    const ps = (v) => perShare(v, cur, x.p);
    const price = (v) => (v > 0 ? ps(v) : "n/m");
    set("o-pre", amount(res.pre, u), res.pre < 0);
    set("o-cp", amount(res.cp, u), res.cp < 0);
    set("o-ev", amount(res.ev, u), res.ev < 0);
    set("o-epv", amount(res.epv, u), res.epv < 0);
    set("o-epvps", ps(res.epvps), res.epvps < 0);
    set("o-epvpct", pct(res.epvpct), res.epvpct < 0);
    set("o-grow", pct(res.grow));
    set("x-rule", { pass: "Passes", fail: "Fails", negative: "Fails: no cash profits" }[res.rule]);

    const oeIds = ["o-oe", "o-oeps", "o-cy", "o-p5", "o-p8", "o-y5", "o-y10", "o-y15", "o-orate", "o-maxp", "o-bmaxp", "o-ideal", "o-cyi", "o-vsmax", "x-sell"];
    if (!res.hasOE) {
      oeIds.forEach((id) => set(id, "–"));
    } else {
      const yrs = (v) => (v === null ? "n/m" : v === 0 ? "Already there" : v.toFixed(1) + " years");
      set("o-oe", amount(res.oe, u), res.oe < 0);
      set("o-oeps", ps(res.oeps), res.oeps < 0);
      set("o-cy", pct(res.cy, 1), res.cy < 0);
      set("o-p5", price(res.p5)); set("o-p8", price(res.p8));
      set("o-y5", yrs(res.y5)); set("o-y10", yrs(res.y10)); set("o-y15", yrs(res.y15));
      const haveRate = raw.infl !== null;
      set("o-orate", haveRate ? pct(res.orate, 2) : "–");
      set("o-maxp", haveRate ? price(res.maxp) : "–");
      set("o-bmaxp", raw.bond !== null ? price(res.bmaxp) : "–");
      set("o-ideal", haveRate ? price(res.ideal) : "–");
      set("o-cyi", haveRate && res.ideal > 0 ? pct(res.cyi, 1) : "–");
      set("o-vsmax", haveRate && res.maxp > 0 ? (res.vsmax >= 0 ? pct(res.vsmax) + " above" : pct(-res.vsmax) + " below") : "–");
      set("x-sell", !haveRate ? "–" : { sell: "Consider selling", none: "No signal", "n/m": "n/m" }[res.sell]);
    }

    const tag = res.rule === "pass" ? ["Passes Oakley's rule", ""] : res.rule === "fail" ? ["Fails Oakley's rule", " fail"] : ["No cash profits", " fail"];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, res, cur)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>EPV ${pct(res.epvpct)} of price</span><span>${tag[0].replace(" Oakley's rule", "")} ↓</span>`;

    const sig = JSON.stringify([raw, $("u").value, $("su").value]);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "epv", result: res.rule, source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    settings.forEach((k) => { v[k] = $(k).value; });
    fields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    hfields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.h] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }

  // ── Helpers ──
  const hfields = [...form.querySelectorAll("input[data-h]")];
  const hv = (k) => { const el = form.querySelector(`input[data-h="${k}"]`); const v = el ? parseNumber(el.value) : null; return ok(v) ? v : null; };
  const writeField = (k, v, u) => {
    const f = $("f-" + k);
    const shown = Math.round((v / u) * 1000) / 1000;
    f.value = Math.abs(shown) >= 1000 ? fmtInput(shown) : String(shown);
  };
  const fmtH = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  function runHelpers(changed) {
    const { x, u, cur } = read();
    // A: average EBIT
    const e = [1, 2, 3, 4, 5].map((i) => hv("he" + i)), rv = [1, 2, 3, 4, 5].map((i) => hv("hr" + i));
    const A = helperEbit(e, rv);
    A.margins.forEach((m, i) => { $("hm" + (i + 1)).textContent = m === null ? "" : pct(m, 1); });
    $("h-ebit-avg").textContent = A.n ? `${fmtH(A.avg)} (${A.n} year${A.n > 1 ? "s" : ""})` : "–";
    if (changed === "A" && A.n) writeField("ebit", A.avg * u, u);
    // B: maintenance capex
    const B = helperCapex(hv("hcr"), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => hv("hc" + i)), x.da / u);
    const show = (id, v) => { $(id).textContent = v > 0 ? fmtH(v) : "–"; };
    show("h-cap-rep", B.rep); show("h-cap-5", B.a5); show("h-cap-10", B.a10); show("h-cap-da", B.d120); show("h-cap-sug", B.sug);
    $("h-cap-method").textContent = B.method;
    const pick = { rep: B.rep, a5: B.a5, a10: B.a10, da: B.d120, sug: B.sug };
    form.querySelectorAll(".hbtn").forEach((b) => { b.disabled = !(pick[b.dataset.use] > 0); b.dataset.v = pick[b.dataset.use]; });
    // C: normalized net income
    const ni = hv("hni");
    const C = ni === null ? null : helperNI(ni, hv("hot") || 0, hv("hon") || 0, x.tax);
    $("h-ni-res").textContent = C === null ? "–" : fmtH(C);
    if ((changed === "C" || changed === "tax") && C !== null) writeField("ni", C * u, u);
  }
  hfields.forEach((f) => {
    const group = f.dataset.h.startsWith("he") || f.dataset.h.startsWith("hr") ? "A" : f.dataset.h.startsWith("hc") ? "B" : "C";
    f.addEventListener("input", (ev) => { ev.stopPropagation(); runHelpers(group); render("typing"); });
    f.addEventListener("blur", () => { const v = parseNumber(f.value); if (ok(v) && Math.abs(v) >= 1000) f.value = fmtInput(v); });
  });
  form.querySelectorAll(".hbtn").forEach((b) => b.addEventListener("click", () => {
    const v = Number(b.dataset.v);
    if (v > 0) { writeField("mcx", v * Number($("u").value), Number($("u").value)); render("typing"); runHelpers(); }
  }));

  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (ev) => {
    if (ev.target.dataset && ev.target.dataset.h) return;
    runHelpers(ev.target.id === "f-tax" ? "tax" : undefined);
    render("typing");
  });
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
    track("share_calculation", { tool: "epv" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    hfields.forEach((f) => { f.value = ""; });
    showErrors([]); clearAll(); render("typing"); runHelpers();
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
    runHelpers();
    render("link");
  } else {
    runHelpers();
    render("typing");
  }
}
