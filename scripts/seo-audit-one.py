#!/usr/bin/env python3
import json
import re
import ssl
import urllib.parse
import urllib.request

PATH = "/cinema/12-luchshix-serialov-pro-mafiyu-i-gangsterov"
SLUG = "12-luchshix-serialov-pro-mafiyu-i-gangsterov"
CTX = ssl._create_unverified_context()


def get(url: str, host: str | None = None) -> tuple[int, str, dict[str, str]]:
    headers = {"User-Agent": "Mozilla/5.0 SEO-Audit"}
    if host:
        headers["Host"] = host
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=40, context=CTX) as res:
        out = {k.lower(): v for k, v in res.headers.items()}
        return res.status, res.read().decode("utf-8", "replace"), out


def main() -> None:
    # Hit local frontend with public Host so we see the same rendered HTML.
    code, html, headers = get(f"http://127.0.0.1:3010{PATH}", host="topovik.com")
    print("HTTP", code)
    print("cache-control", headers.get("cache-control"))
    print("x-robots", headers.get("x-robots-tag"))
    print("--- via nginx https ---")
    try:
        c2, _, h2 = get(f"https://127.0.0.1{PATH}", host="topovik.com")
        print("nginx_https", c2, "x-robots", h2.get("x-robots-tag"))
    except Exception as e:
        print("nginx_https_error", e)

    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    print("TITLE:", re.sub(r"\s+", " ", m.group(1)).strip() if m else None)

    for pat in [
        r"<meta[^>]+name=[\"']description[\"'][^>]*>",
        r"<meta[^>]+name=[\"']robots[\"'][^>]*>",
        r"<link[^>]+rel=[\"']canonical[\"'][^>]*>",
        r"<meta[^>]+property=[\"']og:[^\"']+[\"'][^>]*>",
        r"<meta[^>]+name=[\"']twitter:[^\"']+[\"'][^>]*>",
    ]:
        for x in re.findall(pat, html, re.I):
            print(re.sub(r"\s+", " ", x)[:400])

    h1 = [
        re.sub(r"<[^>]+>", "", x).strip()
        for x in re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    ]
    print("H1:", h1[:3])

    for tag in ("h2", "h3"):
        hs = [
            re.sub(r"<[^>]+>", "", x).strip()
            for x in re.findall(rf"<{tag}[^>]*>(.*?)</{tag}>", html, re.I | re.S)
        ]
        print(f"{tag}_count", len(hs), "sample", hs[:10])

    blocks = re.findall(
        r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
        html,
        re.I | re.S,
    )
    print("jsonld_blocks", len(blocks))
    for i, b in enumerate(blocks[:2]):
        print("LD", i, json.dumps(json.loads(b), ensure_ascii=False)[:1400])

    imgs = re.findall(r"<img\b[^>]*>", html, re.I)
    missing_alt = [
        i
        for i in imgs
        if (not re.search(r"\balt=", i, re.I))
        or re.search(r"\balt=[\"']\s*[\"']", i)
    ]
    print("imgs", len(imgs), "missing_alt", len(missing_alt))

    text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", "", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    print("text_chars", len(text))
    print("text_sample:", text[:280])

    sm = urllib.request.urlopen("http://127.0.0.1:3010/sitemap.xml", timeout=60).read().decode()
    print("in_sitemap", SLUG in sm)
    if SLUG in sm:
        i = sm.index(SLUG)
        print("sitemap_snip", sm[max(0, i - 80) : i + 120].replace("\n", " "))

    q = urllib.parse.quote(SLUG)
    api = (
        "http://127.0.0.1:1340/api/articles?status=published"
        f"&filters[slug][$eq]={q}&populate[seo]=true&populate[category][fields][0]=slug"
        "&fields[0]=title&fields[1]=slug&fields[2]=publishedAt&fields[3]=updatedAt"
        "&fields[4]=legacyPath&fields[5]=views&fields[6]=likes"
    )
    raw = urllib.request.urlopen(api, timeout=30).read().decode()
    data = json.loads(raw)
    print("strapi", json.dumps(data, ensure_ascii=False)[:1800])


if __name__ == "__main__":
    main()
