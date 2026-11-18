// Net-net calculator. Same formulas as Ezra's Deep Value spreadsheet
// (sheet "Template"), cell references noted next to each line.
import { parseNumber, money, perShare, amount, multiple, pct, track,
  shareUrl, readQuery, copyText, article } from "./calc.js";

export const DEFAULTS = { ar_h: 75, in_h: 50, max: 0.66 };
const KEY_FIELDS = ["ca", "l", "sh", "p"];

// All money inputs arrive already converted to whole currency units,
// shares to whole shares. Blank inputs arrive as 0, except mc and ev (null).
export function compute(x) {
  const totalCash = x.c + x.s + x.r;                          // C7  = SUM(C4:C6)
  const otherCA = x.ca - totalCash - x.ar - x.in - x.pp;      // C18 = C11-C7-C8-C9-C10
  const mcapCalc = x.sh * x.p;                                // C22 = C20*C21
  const mcap = x.mc ?? mcapCalc;
  const evCalc = mcap + x.d + x.pf - totalCash;               // C23 = C22+C14+C17-C7
  const ev = x.ev ?? evCalc;

  const totals = {
    ncav: x.ca - x.l,                                         // C26
    adj: x.ca - (x.l + x.ob + x.pf),                          // C28
    nnwc: totalCash + x.ar * x.ar_h / 100 + x.in * x.in_h / 100 - x.l, // C39
    netCash: totalCash - x.l,                                 // C30
    wc: x.ca - x.cl,                                          // C32
    schloss: x.ca - x.cl - x.d,                               // C33
    bv: x.a - x.l,                                            // C34
    abv: x.a - x.g - x.ia - x.rou - x.l,                      // C49
  };
  const ps = {}, ratio = {};
  for (const [k, v] of Object.entries(totals)) {
    ps[k] = x.sh > 0 ? v / x.sh : null;                       // D26..D39
    ratio[k] = ps[k] > 0 ? x.p / ps[k] : null;                // C27..C40 ("n/m" when <= 0)
  }
  const test = (r) => (r === null ? "negative" : r <= x.max ? "pass" : "fail");
  return {
    totalCash, otherCA, mcap, mcapCalc, ev, evCalc, totals, ps, ratio,
    graham: test(ratio.ncav),                                 // C43
    modern: test(ratio.adj),                                  // C44
  };
}

// Problems that stop the calculation (errors) and things worth a second look (warnings).
export function check(x, res, raw) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
    else if (v !== null && v < 0) errors.push([k, "Can't be negative."]);
  }
  for (const k of KEY_FIELDS) {
    if (raw[k] === null) errors.push([k, "Needed for the calculation."]);
  }
  if (raw.sh === 0) errors.push(["sh", "Shares can't be zero."]);
  if (raw.p === 0) errors.push(["p", "Price can't be zero."]);
  for (const k of ["ar_h", "in_h"]) if (raw[k] > 100) errors.push([k, "Between 0 and 100."]);
  if (errors.length || !res) return { errors, warnings };

  const tol = (a) => Math.max(1, Math.abs(a) * 1e-6);
  if (res.otherCA < -tol(x.ca)) warnings.push("The cash, receivables, inventory and prepaid lines add up to more than total current assets. One of them is probably counted twice.");
  if (x.a > 0 && x.ca > x.a) warnings.push("Total current assets are bigger than total assets. Check both numbers.");
  if (raw.a === null) warnings.push("Total assets is blank, so book value is left out.");
  else if (x.g + x.ia + x.rou > x.a) warnings.push("Goodwill, intangibles and right-of-use assets add up to more than total assets. Check those lines.");
  if (x.cl > x.l) warnings.push("Current liabilities are bigger than total liabilities. Check both numbers.");
  if (x.d > x.l) warnings.push("Long-term debt is bigger than total liabilities. Check both numbers.");
  if (x.ca > 0) {
    const m = res.mcapCalc / x.ca;
    if (m > 500 || m < 0.002) warnings.push(`Market cap comes out at ${m > 1 ? Math.round(m).toLocaleString("en-US") + " times" : "1/" + Math.round(1 / m).toLocaleString("en-US") + " of"} current assets. That usually means the units for amounts or shares are off.`);
  }
  if (x.mc !== null && Math.abs(x.mc - res.mcapCalc) > 0.05 * res.mcapCalc) warnings.push("The market cap you typed is more than 5% away from shares × price. Check the share count, or whether your market cap uses basic shares.");
  if (x.ev !== null && Math.abs(x.ev - res.evCalc) > 0.05 * res.mcap) warnings.push("The EV you typed is more than 5% away from market cap + debt + preferred − cash. Your source may include leases or minority interest.");
  if (x.max > 1) warnings.push("Your limit is above 1, so a stock can pass while trading above its NCAV.");
  return { errors, warnings };
}

// One plain-English line about the result. Draft copy, Ezra edits in step 5.
export function interpret(x, res, cur) {
  const p = perShare(x.p, cur, x.p);
  const n = res.ps.ncav, r = res.ratio.ncav;
  let s;
  if (r === null) {
    s = `Total liabilities are bigger than current assets, so NCAV is negative. There's no net-net discount to measure here.`;
  } else if (r <= x.max) {
    s = `At ${p} you're paying ${multiple(r)} NCAV, ${article(pct(1 - r))} ${pct(1 - r)} discount to ${perShare(n, cur, x.p)} per share. That clears your ${x.max} limit.`;
  } else if (r < 1) {
    s = `At ${p} you're paying ${multiple(r)} NCAV, ${article(pct(1 - r))} ${pct(1 - r)} discount to ${perShare(n, cur, x.p)} per share. It's below NCAV, but not by enough to clear your ${x.max} limit.`;
  } else {
    s = `At ${p} you're paying ${multiple(r)} NCAV (${perShare(n, cur, x.p)} per share). The market already prices the company above its net current assets.`;
  }
  if (r !== null && res.totals.adj !== res.totals.ncav) {
    if (res.ratio.adj === null) s += " Once you take out off-balance-sheet liabilities and preferred stock, modern NCAV turns negative.";
    else if (res.modern !== res.graham) s += ` On modern NCAV it's ${multiple(res.ratio.adj)}, which ${res.modern === "pass" ? "clears" : "misses"} your limit.`;
  }
  return s;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("netnet");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const settings = ["cur", "u", "su"];
  const fmtInput = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });

  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const u = Number($("u").value), su = Number($("su").value);
    const ok = (v) => v !== null && !Number.isNaN(v);
    const x = {};
    fields.forEach((f) => {
      const k = f.dataset.k, kind = f.dataset.kind, v = ok(raw[k]) ? raw[k] : 0;
      x[k] = kind === "money" ? v * u : kind === "shares" ? v * su : v;
    });
    x.mc = ok(raw.mc) ? raw.mc * u : null;
    x.ev = ok(raw.ev) ? raw.ev * u : null;
    for (const [k, d] of Object.entries(DEFAULTS)) if (raw[k] === null) x[k] = d;
    return { raw, x, u, cur: $("cur").value };
  }

  // Shows field errors. "quiet" hides the "needed" ones while the person is still typing.
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

  function clearOutputs() {
    form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });
  }

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x, u, cur } = read();
    const pre = check(x, null, raw);
    showErrors(pre.errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");
    // Total cash and other current assets fill in as soon as there's something to add.
    const partial = compute(x);
    set("o-totalCash", amount(partial.totalCash, u));
    set("o-otherCA", raw.ca === null ? "–" : amount(partial.otherCA, u), partial.otherCA < 0);
    $("f-mc").placeholder = raw.sh && raw.p ? amount(partial.mcapCalc, u) : "";
    $("f-ev").placeholder = raw.sh && raw.p ? amount(partial.evCalc, u) : "";

    if (pre.errors.length) {
      ["ncav", "adj", "netCash", "wc", "schloss", "bv", "abv", "nnwc"].forEach((k) => { set("t-" + k, "–"); set("ps-" + k, "–"); set("r-" + k, "–"); });
      set("x-graham", "–"); set("x-modern", "–");
      warn.hidden = true; bar.hidden = true;
      const missing = pre.errors.some(([, m]) => m.startsWith("Needed"));
      verdict.innerHTML = `<p>${missing ? "Fill in the four fields marked * and the results appear as you type." : "Fix the fields marked above."}</p>`;
      return;
    }
    const res = compute(x);
    const { warnings } = check(x, res, raw);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";

    const ps = (v) => (v === null ? "n/m" : perShare(v, cur, x.p));
    for (const k of Object.keys(res.totals)) {
      const skip = (k === "bv" || k === "abv") && raw.a === null;
      set("t-" + k, skip ? "–" : amount(res.totals[k], u), res.totals[k] < 0);
      set("ps-" + k, skip ? "–" : ps(res.ps[k]), res.totals[k] < 0);
      set("r-" + k, skip ? "–" : multiple(res.ratio[k]));
    }
    const word = { pass: "Passes", fail: "Fails", negative: "Fails: negative" };
    set("x-graham", word[res.graham]); set("x-modern", word[res.modern]);

    const tag = res.graham === "pass" ? ["Passes your test", ""] :
                res.graham === "fail" ? ["Fails your test", " fail"] : ["Negative NCAV", " fail"];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, res, cur)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>P/NCAV ${multiple(res.ratio.ncav)}</span><span>${tag[0]} ↓</span>`;

    // One Analytics event per finished calculation, not per keystroke.
    const sig = JSON.stringify([raw, $("u").value, $("su").value]);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "net-net", result: res.graham, source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
    return res;
  }

  function values() {
    const v = {};
    settings.forEach((k) => { v[k] = $(k).value; });
    fields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }

  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", () => render("typing"));
  settings.forEach((k) => $(k).addEventListener("change", () => render("typing")));
  fields.forEach((f) => f.addEventListener("blur", () => {
    const v = parseNumber(f.value);
    if (v !== null && !Number.isNaN(v) && Math.abs(v) >= 1000) f.value = fmtInput(v);
    render("blur");
  }));

  // Hide the phone bar while the verdict itself is on screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { $("stickybar").classList.toggle("away", e.isIntersecting); })
      .observe($("verdict"));
  }

  $("share-link").addEventListener("click", () => {
    const url = shareUrl(values());
    try { history.replaceState(null, "", url); } catch (e) { /* sandboxed preview */ }
    copyText(url).then(() => {
      const b = $("share-link"); b.textContent = "Link copied";
      setTimeout(() => { b.textContent = "Copy link to this calculation"; }, 2000);
    }).catch(() => {});
    track("share_calculation", { tool: "net-net" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    showErrors([]); clearOutputs(); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });

  // Load a shared calculation from the address bar.
  const q = readQuery();
  if (Object.keys(q).length) {
    settings.forEach((k) => { if (q[k] && [...$(k).options].some((o) => o.value === q[k])) $(k).value = q[k]; });
    fields.forEach((f) => {
      if (q[f.dataset.k] === undefined) return;
      const v = parseNumber(q[f.dataset.k]);
      f.value = v !== null && !Number.isNaN(v) && Math.abs(v) >= 1000 ? fmtInput(v) : q[f.dataset.k];
    });
    render("link");
  }
}
