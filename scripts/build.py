"""Builds the site into docs/. Run: python scripts/build.py"""
import hashlib, shutil
from pathlib import Path
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"
SITE_URL = "https://tools.ezrasnotes.com"
NEWSLETTER_URL = "https://www.ezrasnotes.com"
SUBSCRIBE_URL = "https://www.ezrasnotes.com/subscribe"
SUBSTACK_EMBED = "https://www.ezrasnotes.com/embed"
CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "HKD", "SGD", "SEK",
              "NOK", "DKK", "MXN", "BRL", "CLP", "COP", "KRW", "INR", "ZAR"]


def build():
    data = yaml.safe_load((ROOT / "tools.yaml").read_text(encoding="utf-8"))
    tools = data["tools"]
    env = Environment(loader=FileSystemLoader(ROOT / "templates"),
                      autoescape=select_autoescape(["html"]), trim_blocks=True, lstrip_blocks=True)
    static = ROOT / "static"
    asset_v = hashlib.md5(b"".join(p.read_bytes() for p in sorted(static.iterdir()) if p.is_file())).hexdigest()[:8]
    common = dict(tools=tools, asset_v=asset_v, ga_id=data.get("ga_id", ""), collect_url=data.get("collect_url", ""), site_url=SITE_URL,
                  newsletter_url=NEWSLETTER_URL, subscribe_url=SUBSCRIBE_URL, substack_embed=SUBSTACK_EMBED, currencies=CURRENCIES)

    if OUT.exists():
        for p in OUT.iterdir():
            if p.name != "CNAME":
                shutil.rmtree(p) if p.is_dir() else p.unlink()
    OUT.mkdir(exist_ok=True)
    shutil.copytree(static, OUT / "static")
    (OUT / "CNAME").write_text("tools.ezrasnotes.com\n")
    (OUT / ".nojekyll").write_text("")

    def render(template, page, root, **kw):
        path = OUT / page / "index.html" if page else OUT / "index.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(env.get_template(template).render(page=page, root=root, **common, **kw), encoding="utf-8")

    render("index.html", "", "")
    for t in tools:
        if t["status"] == "live":
            extra = {"rows": data.get(t["slug"].replace("-", "_") + "_rows", [])}
            render(f"{t['slug']}.html", t["slug"] + "/", "../", **extra)
    print("Built", sum(1 for _ in OUT.rglob("index.html")), "pages")


if __name__ == "__main__":
    build()
