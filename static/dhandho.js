// Pabrai's Dhandho bet: The Dhandho Investor (2007), chapter 10 and the cases in chapters 12-15.
// Same arithmetic as Dhandho_Bet_Template.xlsx; the cell of each line is noted.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const NS = 6, NB = 8;
export const DEFAULTS = { yrs: 3, cap: 0.10 };

// Sum of p r / (1 + f r): the slope of expected log growth (Solver sheet).
const slope = (f, out) => out.reduce((s, o) => s + o.p * o.r / (1 + f * o.r), 0);

// Kelly for several outcomes: 60-step bisection between 0 and the upper bound, as in the Excel solver.
export function kelly(out) {
  const worst = Math.min(...out.filter((o) => o.p > 0).map((o) => o.r));
  const ub = worst <= -1 ? 1 - 1e-9 : 1;
  if (slope(0, out) <= 0) return { f: 0, capped: false };
  if (slope(ub, out) > 0) return { f: ub, capped: true };
  let lo = 0, hi = ub;
  for (let k = 1; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (slope(mid, out) > 0) lo = mid; else hi = mid;
  }
  return { f: (lo + hi) / 2, capped: false };
}

export function compute(x) {
  const out = x.outcomes.map((o) => ({ p: o.p || 0, r: x.price > 0 && o.v !== null ? o.v / x.price - 1 : o.r || 0 })); // column F
  const total = out.reduce((s, o) => s + o.p, 0);                                   // C15
  const live = out.filter((o) => o.p > 0);
  const edge = out.reduce((s, o) => s + o.p * o.r, 0);                              // C19
  const best = Math.max(...live.map((o) => o.r)), worst = Math.min(...live.map((o) => o.r)); // C24, C25
  const lose = out.filter((o) => o.r < 0).reduce((s, o) => s + o.p, 0);             // C22
  const wipe = out.filter((o) => o.r <= -1).reduce((s, o) => s + o.p, 0);           // C23
  const yearly = x.yrs > 0 && edge > -1 ? Math.pow(1 + edge, 1 / x.yrs) - 1 : null; // C21
  const shortcut = best > 0 ? edge / best : null;                                   // C28
  const k = kelly(out);                                                             // C29
  const half = k.f / 2;                                                             // C30
  const position = Math.min(k.f, x.cap);                                            // C32
  const bets = x.bets.map((b) => (b === null ? null : b));
  const sum = bets.reduce((s, b) => s + (b || 0), 0);                               // Portfolio!C15
  const scaled = bets.map((b) => (b === null ? null : sum > 1 ? b / sum : b));      // column D
  const capped = bets.map((b) => (b === null ? null : Math.min(b, x.cap)));         // column E (uses the same limit)
  return { out, total, edge, mult: 1 + edge, yearly, lose, wipe, best, worst, shortcut, kelly: k.f, kellyCapped: k.capped, half, position, sum, scaled, capped };
}

export function check(x, res, raw) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (let i = 1; i <= NS; i++) {
    if (raw["p" + i] !== null && (raw["p" + i] < 0 || raw["p" + i] > 100)) errors.push(["p" + i, "Between 0 and 100."]);
    if (raw["r" + i] !== null && raw["r" + i] < -100) errors.push(["r" + i, "You can't lose more than 100%."]);
    if (raw["v" + i] !== null && raw["v" + i] < 0) errors.push(["v" + i, "Can't be negative."]);
  }
  ["price", "yrs", "cap"].forEach((k) => { if (raw[k] !== null && raw[k] < 0) errors.push([k, "Can't be negative."]); });
  for (let i = 1; i <= NB; i++) if (raw["b" + i] !== null && raw["b" + i] < 0) errors.push(["b" + i, "Can't be negative."]);
  if (!errors.length) {
    const any = [1, 2, 3, 4, 5, 6].some((i) => raw["p" + i] !== null);
    const sum = [1, 2, 3, 4, 5, 6].reduce((s, i) => s + (raw["p" + i] || 0), 0);
    if (!any) errors.push(["p1", "Needed for the calculation."]);
    else if (Math.abs(sum - 100) > 0.001) errors.push(["p1", `Probabilities add up to ${Math.round(sum * 100) / 100}%. They have to add up to 100%.`]);
  }
  if (errors.length || !res) return { errors, warnings };
  if (res.kellyCapped) warnings.push("Kelly says 100% or more: the odds are extraordinary. Check them again. Kelly assumes you have them exactly right, and you never do.");
  if (res.wipe === 0 && res.lose === 0) warnings.push("None of your outcomes loses money. Every investment has some chance of a loss: Pabrai always gives the worst case at least a few percent.");
  if (res.kelly > 0 && res.kelly > 2 * x.cap && x.cap > 0) warnings.push(`Kelly says ${pct(res.kelly)}, far above your ${pct(x.cap)} limit. Pabrai's answer to that gap: the odds are only an estimate, so he keeps each bet near 10% and holds several very favorable ones.`);
  if (res.edge > 0 && res.shortcut !== null && res.kelly - res.shortcut > 0.15) warnings.push("With more than two outcomes the shortcut (edge ÷ odds) understates the bet. Kelly for several outcomes is the one Pabrai uses in his cases.");
  return { errors, warnings };
}

export function interpret(x, res) {
  if (res.edge <= 0) return `The expected return is ${pct(res.edge, 1)}. With no edge, Kelly says don't bet.`;
  const tail = res.lose === 0 ? "and no chance of losing money" : `and a ${pct(res.lose, 1)} chance of losing money`;
  return `You expect to get back ${res.mult.toFixed(2)} times your money (${pct(res.yearly, 1)} a year over ${x.yrs} years), ${tail}. Kelly says to bet ${pct(res.kelly, 1)} of your bankroll; the shortcut says ${res.shortcut === null ? "n/m" : pct(res.shortcut, 1)}. With your ${pct(x.cap)} limit, the position is ${pct(res.position, 1)}.`;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("dhform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const nums = fields.filter((f) => !f.dataset.text);
  const ok = (v) => v !== null && !Number.isNaN(v);

  function read() {
    const raw = {};
    nums.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const P = (k) => (ok(raw[k]) ? raw[k] / 100 : null), N = (k) => (ok(raw[k]) ? raw[k] : null);
    const x = {
      price: N("price") || 0, yrs: N("yrs") === null ? DEFAULTS.yrs : N("yrs"), cap: P("cap") === null ? DEFAULTS.cap : P("cap"),
      outcomes: [1, 2, 3, 4, 5, 6].map((i) => ({ p: P("p" + i), r: P("r" + i), v: N("v" + i) })),
      bets: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => P("b" + i)),
    };
    return { raw, x };
  }
  function showErrors(errors, quiet) {
    nums.forEach((f) => {
      f.removeAttribute("aria-invalid");
      const e = f.parentElement.querySelector(".err");
      if (e) e.remove();
    });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`);
      if (!f || f.getAttribute("aria-invalid")) return;
      if (quiet && msg.startsWith("Needed")) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span");
      e.className = "err"; e.textContent = msg;
      (f.closest("td") || f.parentElement).appendChild(e);
    });
  }
  function set(id, text, neg) { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); }
  const clearAll = () => form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x } = read();
    const sum = [1, 2, 3, 4, 5, 6].reduce((s, i) => s + (ok(raw["p" + i]) ? raw["p" + i] : 0), 0);
    set("o-total", (Math.round(sum * 100) / 100) + "%", Math.abs(sum - 100) > 0.001 && sum > 0);
    const pre = check(x, null, raw);
    showErrors(pre.errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");
    // Return used column shows as soon as there's a price or a return
    for (let i = 1; i <= NS; i++) {
      const o = x.outcomes[i - 1];
      const r = x.price > 0 && o.v !== null ? o.v / x.price - 1 : o.r;
      set("o-r" + i, o.p === null && o.r === null && o.v === null ? "" : r === null ? "–" : pct(r, 1), r !== null && r < 0);
    }
    // Portfolio works on its own
    const pres = compute({ ...x, outcomes: [{ p: 1, r: 0, v: null }] });
    pres.scaled.forEach((v, i) => set("o-s" + (i + 1), v === null ? "" : pct(v, 1)));
    pres.capped.forEach((v, i) => set("o-c" + (i + 1), v === null ? "" : pct(v, 1)));
    set("o-bsum", pres.sum ? pct(pres.sum) : "–");
    if (pre.errors.length) {
      ["o-edge", "o-mult", "o-year", "o-lose", "o-wipe", "o-best", "o-worst", "o-short", "o-kelly", "o-half", "o-pos"].forEach((id) => set(id, "–"));
      warn.hidden = true; bar.hidden = true;
      const missing = pre.errors.some(([, m]) => m.startsWith("Needed"));
      const sumErr = pre.errors.find(([, m]) => m.startsWith("Probabilities add up"));
      verdict.innerHTML = `<p>${missing ? "Fill in the outcomes, with probabilities that add up to 100%, and the results appear as you type." : sumErr ? sumErr[1] : "Fix the fields marked above."}</p>`;
      return;
    }
    const res = compute(x);
    const { warnings } = check(x, res, raw);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";
    set("o-edge", pct(res.edge, 1), res.edge < 0);
    set("o-mult", res.mult.toFixed(2) + "x");
    set("o-year", res.yearly === null ? "n/m" : pct(res.yearly, 1), res.yearly !== null && res.yearly < 0);
    set("o-lose", pct(res.lose, 1));
    set("o-wipe", pct(res.wipe, 1));
    set("o-best", pct(res.best, 1), res.best < 0);
    set("o-worst", pct(res.worst, 1), res.worst < 0);
    set("o-short", res.shortcut === null ? "n/m" : pct(res.shortcut, 1), res.shortcut !== null && res.shortcut < 0);
    set("o-kelly", res.kellyCapped ? "100% or more" : pct(res.kelly, 1));
    set("o-half", pct(res.half, 1));
    set("o-pos", pct(res.position, 1));
    const tag = res.edge <= 0 ? ["No edge", " fail"] : res.kelly >= 0.5 ? ["A Dhandho bet", ""] : res.kelly >= 0.2 ? ["Favorable odds", ""] : ["Thin edge", " fail"];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, res)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>Kelly ${res.kellyCapped ? "100%+" : pct(res.kelly)}</span><span>Edge ${pct(res.edge)} ↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "dhandho", result: tag[0], source }); };
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
    track("share_calculation", { tool: "dhandho" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    showErrors([]); clearAll(); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  $("dh-example") && $("dh-example").addEventListener("click", () => {
    const ex = { n1: "Three times your money or more", p1: 90, r1: 200, n2: "Break even", p2: 5, r2: 0, n3: "Lose up to 10%", p3: 4, r3: -10, n4: "Lose it all", p4: 1, r4: -100 };
    fields.forEach((f) => { if (ex[f.dataset.k] !== undefined) f.value = ex[f.dataset.k]; else if (/^[nprv][1-6]$/.test(f.dataset.k)) f.value = ""; });
    render("blur");
  });

  const q = readQuery();
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  render(Object.keys(q).length ? "link" : "typing");
}
