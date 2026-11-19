// Google Apps Script behind "Send to Ezra" and "Leave a testimonial" on tools.ezrasnotes.com.
// Standalone project in ezra@ezrasnotes.com, writing to the private sheet below. Deploy as a web app:
// Execute as: Me · Who has access: Anyone. Paste the /exec URL into collect_url in tools.yaml.
// Nothing is public: rows only show on the site if Ezra writes "yes" in the Publish column
// and the person ticked the consent box.

const SHEET_ID = "17TV-ha7dQ89J1tS6h_lJOWrA3pQvjlG1BIY3y00A5go"; // "Tools site - community (private)"

const TABS = {
  calculation: ["Received", "Tool", "Company", "Name", "Consent", "Result", "Link", "Publish", "Notes"],
  testimonial: ["Received", "Tool", "Name", "Handle", "Role", "Testimonial", "Consent", "Publish", "Notes"],
};
const NAMES = { calculation: "Calculations", testimonial: "Testimonials" };

function sheetFor(type) {
  if (!type) { sheetFor("calculation"); return sheetFor("testimonial"); } // running it from the editor sets up both tabs
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
    if (d.type === "calculation") {
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

// Feed for the site: only testimonials with consent = yes and Publish = yes.
function doGet() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(NAMES.testimonial);
  if (!sh) return out([]);
  const rows = sh.getDataRange().getValues().slice(1);
  const list = rows.filter((r) => r[6] === "yes" && String(r[7]).toLowerCase() === "yes")
    .map((r) => ({ tool: r[1], name: r[2], handle: r[3], role: r[4], text: r[5] }));
  return out(list);
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor to create both tabs and grant access.
function setup() { sheetFor("calculation"); sheetFor("testimonial"); }
