"""Draws the 1200x630 link-preview images into static/og/. Run by hand when a tool is added or renamed:
python scripts/og_images.py path/to/archivo-black.woff2
Needs Playwright and Chrome. Black with white type, like the Tools covers on Substack."""
import asyncio, base64, html, sys
from pathlib import Path
import yaml
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static" / "og"

PAGE = """<!doctype html><html><head><style>
@font-face {{ font-family: AB; src: url(data:font/woff2;base64,{font}) format('woff2'); }}
* {{ margin: 0; box-sizing: border-box; }}
body {{ width: 1200px; height: 630px; background: #000; color: #fff; font-family: Lora, Georgia, serif; padding: 56px 72px; display: flex; flex-direction: column; }}
.row {{ display: flex; justify-content: space-between; font-weight: 700; font-size: 22px; letter-spacing: .14em; text-transform: uppercase; }}
.mid {{ flex: 1; display: flex; flex-direction: column; justify-content: center; }}
h1 {{ font-family: AB; font-weight: 400; text-transform: uppercase; line-height: 1.04; letter-spacing: .01em; max-width: 1056px; text-wrap: balance; }}
.sub {{ font-weight: 700; font-size: 26px; letter-spacing: .14em; text-transform: uppercase; margin-top: 30px; }}
.foot {{ font-size: 18px; font-weight: 600; }}
</style></head><body>
<div class="row"><span>Tools</span><span>{right}</span></div>
<div class="mid"><h1 id="t">{title}</h1><p class="sub">{tag}</p></div>
<div class="row foot"><span>Ezra's Notes</span><span>tools.ezrasnotes.com</span></div>
</body></html>"""


FIT = """async () => { await document.fonts.ready; const h = document.getElementById('t');
  let s = 128; const lh = () => h.getBoundingClientRect().height / (s * 1.02);
  const wide = () => { const r = document.createRange(); r.selectNodeContents(h); return r.getBoundingClientRect().width > 1056; };
  h.style.fontSize = s + 'px';
  while (s > 60 && (wide() || lh() > (s > 100 ? 1.1 : 2.1))) { s -= 2; h.style.fontSize = s + 'px'; } }"""


async def main(font_path):
    font = base64.b64encode(Path(font_path).read_bytes()).decode()
    tools = yaml.safe_load((ROOT / "tools.yaml").read_text(encoding="utf-8"))["tools"]
    cards = [("og-image", "Value investing tools", "Free · No sign-up", "Free calculators")]
    cards += [(t["slug"], t["og_title"], "Free calculator", t["og_sub"]) for t in tools if t.get("og")]
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg = await b.new_page(viewport={"width": 1200, "height": 630})
        for slug, title, right, tag in cards:
            await pg.set_content(PAGE.format(font=font, title=html.escape(title), right=html.escape(right), tag=html.escape(tag)))
            await pg.evaluate(FIT)
            await pg.screenshot(path=str(OUT / f"{slug}.png"))
        await b.close()
    print(f"{len(cards)} images in {OUT}")

asyncio.run(main(sys.argv[1]))
