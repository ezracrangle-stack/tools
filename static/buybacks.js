// Buybacks and stock-based compensation. Same arithmetic as Buybacks_Template.xlsx.
// A. Mauboussin and Callahan, "Which One Is It? Equity Issuance and Retirement" (Counterpoint Global, July 2024).
// B. Mauboussin and Callahan, "Capital Allocation" (December 2022), Exhibit 39: who wins from a buyback.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const MEDIANS = { sbc: 0.008, buy: 0.015 };
// Exhibit 8: annual TSR 2021-2023 for Russell 3000 companies with sales over $1 billion. [average, median]
export const TSR = { "low-low": [0.094, 0.076], "low-high": [0.137, 0.114], "high-low": [-0.001, 0.026], "high-high": [0.053, 0.062] };

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// years: [{rev, sbc, buy, mcap, shares, bought}] oldest first (up to 3). start = shares at the start of year 1.
export function issuance(years, start = null, price = null, med = MEDIANS) {
  const rows = years.map((y) => ({
    sbcPct: y.rev > 0 && has(y.sbc) ? y.sbc / y.rev : null,
    buyPct: y.mcap > 0 && has(y.buy) ? y.buy / y.mcap : null,
    avgPrice: y.bought > 0 && has(y.buy) ? y.buy / y.bought : null,
  }));
  const sbcAvg = avg(rows.map((r) => r.sbcPct).filter((x) => x !== null));
  const buyAvg = avg(rows.map((r) => r.buyPct).filter((x) => x !== null));
  const sbcLevel = sbcAvg === null ? null : sbcAvg > med.sbc ? "high" : "low";
  const buyLevel = buyAvg === null ? null : buyAvg > med.buy ? "high" : "low";
  const quadrant = sbcLevel && buyLevel ? `${sbcLevel}-${buyLevel}` : null;
  const last = [...years].reverse().find((y) => has(y.shares));
  const end = last ? last.shares : null;
  const dilution = start > 0 && end > 0 ? 1 - start / end : null;
  const sbcTot = years.reduce((s, y) => s + (has(y.sbc) ? y.sbc : 0), 0);
  const buyTot = years.reduce((s, y) => s + (has(y.buy) ? y.buy : 0), 0);
  const withShares = years.filter((y) => y.bought > 0);
  const paid = withShares.length ? withShares.reduce((s, y) => s + (has(y.buy) ? y.buy : 0), 0) / withShares.reduce((s, y) => s + y.bought, 0) : null;
  return {
    rows, sbcAvg, buyAvg, sbcLevel, buyLevel, quadrant, tsr: quadrant ? TSR[quadrant] : null,
    end, dilution, sbcTot, buyTot, net: buyTot - sbcTot, offset: buyTot > 0 ? Math.min(1, sbcTot / buyTot) : null,
    paid, vsToday: paid > 0 && price > 0 ? price / paid - 1 : null,
  };
}

// Exhibit 39. value = your estimate of the equity's total value.
export function whoWins(value, shares, price, amount) {
  const before = value > 0 && shares > 0 ? value / shares : null;
  const ratio = before !== null && price > 0 ? price / before : null;
  const ok = value > 0 && shares > 0 && price > 0 && has(amount) && amount >= 0 && amount / price < shares && amount < value;
  if (!ok) return { before, ratio, ok: false };
  const bought = amount / price, left = shares - bought, after = (value - amount) / left;
  const sellers = price - before, holders = after - before;
  return { before, ratio, ok: true, bought, left, after, sellers, holders, moved: holders * left,
    winner: Math.abs(price - before) < 1e-6 ? "nobody" : price > before ? "sellers" : "holders" };
}

export function check(raw) {
  const errors = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (const [k, v] of Object.entries(raw)) if (has(v) && v < 0) errors.push([k, "Can't be negative."]);
  if (has(raw.amt) && raw.bpx > 0 && has(raw.bsh) && raw.amt / raw.bpx >= raw.bsh) errors.push(["amt", "That buys back every share."]);
  if (has(raw.amt) && has(raw.val) && raw.amt >= raw.val) errors.push(["amt", "Must be less than the value of the equity."]);
  return errors;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("bbform")) {
  const form = document.getElementById("bbform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const num = (v) => (v === null ? "–" : (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const money = (v) => (v === null ? "–" : (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const sm = (v) => (v === null ? "–" : (v >= 0 ? "+" : "−") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const P = (v, d = 2) => (v === null ? "–" : (v < 0 ? "−" : "") + pct(Math.abs(v), d));
  const SP = (v) => (v === null ? "–" : (v >= 0 ? "+" : "−") + pct(Math.abs(v), 1));
  const QL = { "low-low": "SBC low, buybacks low", "low-high": "SBC low, buybacks high", "high-low": "SBC high, buybacks low", "high-high": "SBC high, buybacks high" };
  const QT = {
    "low-high": "It retires more stock than it issues to pay its people. In the paper, this was the best group: 13.7% a year on average from 2021 to 2023.",
    "high-high": "It issues a lot of stock to pay its people and buys a lot back. That's the paper's question: which one is it? If the stock is cheap, issuing it hurts; if it's expensive, buying it back hurts. The group returned 5.3% a year on average.",
    "high-low": "It issues a lot of stock to pay its people and buys little back, so holders get diluted. In the paper, the worst group: −0.1% a year on average.",
    "low-low": "It issues little and buys back little. In the paper, this group returned 9.4% a year on average.",
  };

  function read() {
    const raw = {};
    fields.forEach((f) => { if (!f.dataset.text) raw[f.dataset.k] = parseNumber(f.value); });
    const g = (k) => (has(raw[k]) ? raw[k] : null);
    const years = [0, 1, 2].map((i) => ({ rev: g("rev" + i), sbc: g("sbc" + i), buy: g("buy" + i), mcap: g("mcap" + i), shares: g("sh" + i), bought: g("bt" + i) }));
    return { raw, years, start: g("start"), price: g("px"), b: [g("val"), g("bsh"), g("bpx"), g("amt")] };
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
    const { raw, years, start, price, b } = read();
    const errors = check(raw);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const r = issuance(years, start, price), w = whoWins(...b);
    r.rows.forEach((row, i) => { set(`p-sbc${i}`, P(row.sbcPct)); set(`p-buy${i}`, P(row.buyPct)); set(`p-px${i}`, money(row.avgPrice)); });
    set("o-sbc", P(r.sbcAvg)); set("o-buy", P(r.buyAvg));
    set("l-sbc", r.sbcLevel ? r.sbcLevel[0].toUpperCase() + r.sbcLevel.slice(1) : "–"); set("l-buy", r.buyLevel ? r.buyLevel[0].toUpperCase() + r.buyLevel.slice(1) : "–");
    set("x-quad", r.quadrant ? QL[r.quadrant] : "–", r.quadrant === "high-low" || r.quadrant === "high-high");
    set("o-tsr", r.tsr ? P(r.tsr[0], 1) + " average · " + P(r.tsr[1], 1) + " median" : "–");
    set("o-dil", SP(r.dilution), r.dilution > 0);
    const any = years.some((y) => has(y.sbc) || has(y.buy));
    set("o-sbct", any ? num(r.sbcTot) : "–"); set("o-buyt", any ? num(r.buyTot) : "–"); set("o-net", any ? num(r.net) : "–", any && r.net < 0);
    set("o-off", P(r.offset, 0)); set("o-paid", money(r.paid)); set("o-today", SP(r.vsToday), r.vsToday < 0);

    set("w-before", money(w.before)); set("w-ratio", w.ratio === null ? "–" : w.ratio.toFixed(2) + "x");
    set("w-bought", w.ok ? num(w.bought) : "–"); set("w-after", w.ok ? money(w.after) : "–");
    set("w-sellers", w.ok ? sm(w.sellers) : "–", w.ok && w.sellers < 0); set("w-holders", w.ok ? sm(w.holders) : "–", w.ok && w.holders < 0);
    set("w-moved", w.ok ? (w.moved >= 0 ? "+" : "−") + num(Math.abs(w.moved)) : "–", w.ok && w.moved < 0);
    set("x-win", w.ok ? { sellers: "The sellers", holders: "The holders who stay", nobody: "Nobody: bought at value" }[w.winner] : "–", w.ok && w.winner === "sellers");

    const parts = [];
    const co = $("f-co").value.trim() || "The company";
    if (r.quadrant) {
      parts.push(`<strong>${co}: SBC ${P(r.sbcAvg)} of revenue and buybacks ${P(r.buyAvg)} of market value a year</strong>, against the paper's medians of 0.8% and 1.5%. ${QT[r.quadrant]}`);
    }
    if (r.offset !== null && r.offset > 0) parts.push(`${P(r.offset, 0)} of what it spent on buybacks only offset the stock it gave its people.`);
    if (r.dilution !== null) parts.push(r.dilution > 0 ? `Shareholders were diluted ${pct(r.dilution, 1)} over the period.` : r.dilution < 0 ? `The share count fell: holders own ${pct(-r.dilution, 1)} more of the company.` : "The share count didn't change.");
    if (r.vsToday !== null) parts.push(`It paid ${money(r.paid)} a share on average; today's price is ${pct(Math.abs(r.vsToday), 1)} ${r.vsToday >= 0 ? "above" : "below"} that.`);
    if (w.ok) {
      parts.push(w.winner === "nobody" ? "<strong>Buying at value moves nothing between shareholders.</strong>"
        : `<strong>Buying at ${w.ratio.toFixed(2)}x value, the ${w.winner === "sellers" ? "sellers win" : "holders who stay win"}:</strong> ${sm(w.holders)} a share for those who stay.`);
    }
    if (!parts.length) { verdict.innerHTML = "<p>Fill in at least one year, or the buyback example below, and the results appear as you type.</p>"; bar.hidden = true; return; }
    verdict.innerHTML = `<p>${parts.join(" ")}</p>`;
    bar.hidden = false;
    const bits = [r.quadrant ? QL[r.quadrant] : "", w.ok ? "Buyback: " + (w.winner === "holders" ? "holders win" : w.winner === "sellers" ? "sellers win" : "neutral") : ""].filter(Boolean);
    bar.innerHTML = `<span>${bits.join(" · ")}</span><span>↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "buybacks", result: bits.join(" "), source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    const co = $("f-co").value.trim(); if (co) v.co = co;
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.dataset.text ? f.value.trim() : f.value.replace(/[\s,]/g, ""); });
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
    track("share_calculation", { tool: "buybacks" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
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
