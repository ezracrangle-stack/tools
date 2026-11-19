// Google Apps Script behind "Send to Ezra" and "Leave a testimonial" on tools.ezrasnotes.com.
// Standalone project in ezra@ezrasnotes.com, writing to the private sheet below. Deploy as a web app:
// Execute as: Me · Who has access: Anyone. Paste the /exec URL into collect_url in tools.yaml.
// Nothing is public: rows only show on the site if Ezra writes "yes" in the Publish column
// and the person ticked the consent box.

const SHEET_ID = "17TV-ha7dQ89J1tS6h_lJOWrA3pQvjlG1BIY3y00A5go"; // "Tools site - community (private)"

const TABS = {
  calculation: ["Received", "Tool", "Company", "Name", "Consent", "Result", "Link", "Publish", "Notes"],
  testimonial: ["Received", "Tool", "Name", "Handle", "Role", "Testimonial", "Consent", "Publish", "Notes"],
  beauty: ["Received", "Round", "Guess", "Player id", "Name", "Show name", "Exclude", "Notes"],
};
const NAMES = { calculation: "Calculations", testimonial: "Testimonials", beauty: "Beauty contest" };

function sheetFor(type) {
  if (!type) { sheetFor("calculation"); sheetFor("beauty"); return sheetFor("testimonial"); } // running it from the editor sets up every tab
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(NAMES[type]);
  if (!sh) {
    sh = ss.insertSheet(NAMES[type]);
    sh.appendRow(TABS[type]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, TABS[type].length).setFontWeight("bold");
  }
  return sh;
}

function clip(v, n) { return String(v == null ? "" : v).slice(0, n); }
// Stops a cell from being read as a formula.
function safe(v, n) { const s = clip(v, n); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!TABS[d.type]) return out({ ok: false });
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    const sh = sheetFor(d.type);
    const now = new Date();
    if (d.type === "beauty") {
      const g = Number(d.guess);
      if (!(Number.isInteger(g) && g >= 0 && g <= 100)) { lock.releaseLock(); return out({ ok: false }); }
      sh.appendRow([now, "'" + roundOf(now), g, safe(d.pid, 20), safe(d.name, 60), d.publish_ok ? "yes" : "no", "", ""]);
    } else if (d.type === "calculation") {
      sh.appendRow([now, safe(d.tool, 40), safe(d.company, 60), safe(d.name, 80), d.publish_ok ? "yes" : "no",
        safe(d.result, 1500), safe(d.link, 2000), "", ""]);
    } else {
      sh.appendRow([now, safe(d.tool, 40), safe(d.name, 80), safe(d.handle, 80), safe(d.role, 120),
        safe(d.text, 1500), d.publish_ok ? "yes" : "no", "", ""]);
    }
    lock.releaseLock();
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false });
  }
}

// Feed for the site. ?game=beauty: closed rounds of the beauty contest (no names unless the winner said yes).
// Otherwise: testimonials with consent = yes and Publish = yes.
function doGet(e) {
  if (e && e.parameter && e.parameter.game === "beauty") return out(beautyResults());
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(NAMES.testimonial);
  if (!sh) return out([]);
  const rows = sh.getDataRange().getValues().slice(1);
  const list = rows.filter((r) => r[6] === "yes" && String(r[7]).toLowerCase() === "yes")
    .map((r) => ({ tool: r[1], name: r[2], handle: r[3], role: r[4], text: r[5] }));
  return out(list);
}

// Round = calendar month in UTC, same as static/beauty.js.
function roundOf(d) {
  return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2);
}

// Same arithmetic as summarize() in static/beauty.js. One guess per player id per round (the first);
// write anything in the Exclude column to drop a row.
function beautyResults() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(NAMES.beauty);
  const now = roundOf(new Date());
  if (!sh) return { current: { round: now, n: 0 }, rounds: [] };
  const rows = sh.getDataRange().getValues().slice(1);
  const by = {}, seen = {};
  rows.forEach((r) => {
    const round = String(r[1]), g = Number(r[2]), pid = String(r[3]);
    if (String(r[6]).trim() || !(Number.isInteger(g) && g >= 0 && g <= 100)) return;
    const key = round + "|" + pid;
    if (pid && seen[key]) return;
    seen[key] = true;
    (by[round] = by[round] || []).push({ g: g, name: String(r[4]), show: r[5] === "yes" });
  });
  const rounds = Object.keys(by).filter((k) => k < now).sort().map((k) => {
    const list = by[k], n = list.length;
    const avg = list.reduce((a, x) => a + x.g, 0) / n, target = avg * 2 / 3;
    const best = Math.min.apply(null, list.map((x) => Math.abs(x.g - target)));
    const won = list.filter((x) => Math.abs(Math.abs(x.g - target) - best) < 1e-9);
    const win = won.map((x) => x.g).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const hist = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    list.forEach((x) => { hist[Math.min(9, Math.floor(x.g / 10))] += 1; });
    const names = won.filter((x) => x.show && x.name).map((x) => x.name);
    return { round: k, n: n, avg: avg, target: target, win: win, winners: won.length, names: names, hist: hist };
  });
  return { current: { round: now, n: (by[now] || []).length }, rounds: rounds };
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor to create every tab and grant access.
function setup() { sheetFor(); }
