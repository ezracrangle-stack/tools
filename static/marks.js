// Howard Marks' market temperature: Mastering the Market Cycle (2018), chapter XIII.
// Same arithmetic as Market_Temperature_Template.xlsx.
import { track, shareUrl, readQuery, copyText } from "./calc.js";

export const PAIRS = [
  ["Economy", "Vibrant", "Sluggish"], ["Outlook", "Positive", "Negative"], ["Lenders", "Eager", "Reticent"],
  ["Capital markets", "Loose", "Tight"], ["Capital", "Plentiful", "Scarce"], ["Terms", "Easy", "Restrictive"],
  ["Interest rates", "Low", "High"], ["Yield spreads", "Narrow", "Wide"],
  ["Investors", "Optimistic", "Pessimistic"], ["Investors", "Sanguine", "Distressed"], ["Investors", "Eager to buy", "Uninterested in buying"],
  ["Asset owners", "Happy to hold", "Rushing for the exits"], ["Sellers", "Few", "Many"], ["Markets", "Crowded", "Starved for attention"],
  ["Funds", "Hard to gain entry", "Open to anyone"], ["Funds", "New ones daily", "Only the best can raise money"],
  ["Funds", "General partners hold the cards on terms", "Limited partners have bargaining power"],
  ["Recent performance", "Strong", "Weak"], ["Asset prices", "High", "Low"], ["Prospective returns", "Low", "High"],
  ["Risk", "High", "Low"], ["Popular qualities", "Aggressiveness", "Caution and discipline"], ["Popular qualities", "Broad reach", "Selectivity"],
];

// answers: array of "L" (hot side), "M" (in between), "R" (cold side) or null.
export function compute(answers) {
  const score = answers.map((a) => (a === "L" ? 1 : a === "M" ? 0.5 : a === "R" ? 0 : null)); // column F
  const done = score.filter((s) => s !== null);
  const n = done.length;                                                                      // pairs answered
  const hot = score.filter((s) => s === 1).length, mid = score.filter((s) => s === 0.5).length, cold = score.filter((s) => s === 0).length;
  const temp = n > 0 ? 100 * done.reduce((a, b) => a + b, 0) / n : null;                     // temperature
  let band = null;
  if (temp !== null) band = temp >= 75 ? "hot" : temp >= 60 ? "warm" : temp > 40 ? "middle" : temp > 25 ? "cool" : "cold";
  const stance = temp === null ? null : temp >= 60 ? "More defensive" : temp <= 40 ? "More aggressive" : "Balanced";
  const qualities = temp === null ? null : temp >= 60 ? "Caution and discipline; selectivity" : temp <= 40 ? "Aggressiveness; broad reach" : "Neither extreme";
  const mistakes = temp === null ? null : temp >= 60 ? "Buying too much; paying up; taking too much risk" : temp <= 40 ? "Buying too little; walking away; taking too little risk" : "Both kinds, in smaller doses";
  return { n, hot, mid, cold, temp, band, stance, qualities, mistakes };
}

export const READING = {
  hot: "Hot: most checkmarks on the left. Hold on to your wallet.",
  warm: "Warm: leaning hot. Lean toward limiting the chance of losing money.",
  middle: "In the middle: no strong signal either way.",
  cool: "Cool: leaning cold. Lean toward limiting the chance of missing opportunity.",
  cold: "Cold: most checkmarks on the right. Others are frightened: time to turn aggressive.",
};

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("mkform");
  const $ = (id) => document.getElementById(id);
  const sels = PAIRS.map((_, i) => $("a" + (i + 1)));
  const code = (s) => (s.value === "" ? null : s.value === "In between" ? "M" : s.selectedIndex === 1 ? "L" : "R");
  function set(id, text, neg) { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); }

  let lastSig = "", timer = null;
  function render(source) {
    const answers = sels.map(code);
    sels.forEach((s, i) => { s.closest("tr").dataset.side = answers[i] || ""; });
    const res = compute(answers);
    const verdict = $("verdict"), bar = $("stickybar");
    set("o-n", `${res.n} of ${PAIRS.length}`);
    set("o-hot", String(res.hot)); set("o-mid", String(res.mid)); set("o-cold", String(res.cold));
    if (res.n === 0) {
      ["o-temp", "x-band", "o-stance", "o-qual", "o-mist"].forEach((id) => set(id, "–"));
      $("gauge").style.setProperty("--t", "50"); $("gauge").classList.add("empty");
      bar.hidden = true;
      verdict.innerHTML = "<p>Pick a side for each pair and the temperature appears as you go.</p>";
      return;
    }
    $("gauge").classList.remove("empty");
    $("gauge").style.setProperty("--t", res.temp.toFixed(1));
    set("o-temp", Math.round(res.temp) + " / 100");
    set("x-band", READING[res.band], res.band === "hot");
    set("o-stance", res.stance); set("o-qual", res.qualities); set("o-mist", res.mistakes);
    const mkt = $("f-mkt").value.trim();
    const partial = res.n < PAIRS.length ? ` You've answered ${res.n} of ${PAIRS.length} pairs; the rest don't count.` : "";
    verdict.innerHTML = `<span class="tag${res.band === "hot" ? " fail" : ""}">${Math.round(res.temp)} / 100</span><p>${mkt ? mkt + ": " : ""}${READING[res.band]} Marks would lean ${res.stance === "Balanced" ? "to a balanced stance" : res.stance.toLowerCase()}. The mistakes on offer now: ${res.mistakes.toLowerCase()}.${partial}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>Temperature ${Math.round(res.temp)}</span><span>${res.stance} ↓</span>`;
    const sig = answers.join("");
    clearTimeout(timer);
    if (sig !== lastSig && res.n === PAIRS.length) {
      const send = () => { lastSig = sig; track("calculate", { tool: "marks", result: res.band, source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    const mkt = $("f-mkt").value.trim(); if (mkt) v.mkt = mkt;
    sels.forEach((s, i) => { const c = code(s); if (c) v["a" + (i + 1)] = c; });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("change", () => render("typing"));
  form.addEventListener("input", () => render("typing"));
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
    track("share_calculation", { tool: "marks" });
  });
  $("reset").addEventListener("click", () => {
    sels.forEach((s) => { s.selectedIndex = 0; });
    $("f-mkt").value = "";
    render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });

  const q = readQuery();
  if (q.mkt) $("f-mkt").value = q.mkt;
  sels.forEach((s, i) => { const c = q["a" + (i + 1)]; if (c === "L") s.selectedIndex = 1; else if (c === "M") s.selectedIndex = 2; else if (c === "R") s.selectedIndex = 3; });
  render(Object.keys(q).length ? "link" : "typing");
}
