#!/usr/bin/env python3
"""Replace the section between <!-- BLOG-POSTS:START --> and <!-- BLOG-POSTS:END --> in README.md
with the latest posts from an RSS or Atom feed. Fails soft: if the feed can't be read, README is untouched.

Usage: BLOG_FEED_URL=https://example.com/feed python scripts/update_blog_posts.py [README.md] [max_posts]
"""
from __future__ import annotations

import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime

START, END = "<!-- BLOG-POSTS:START -->", "<!-- BLOG-POSTS:END -->"
ATOM = "{http://www.w3.org/2005/Atom}"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "profile-readme-updater/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def parse_date(s: str | None) -> str:
    if not s:
        return ""
    for fn in (parsedate_to_datetime, lambda x: datetime.fromisoformat(x.replace("Z", "+00:00"))):
        try:
            return fn(s.strip()).strftime("%b %d, %Y")
        except Exception:
            continue
    return ""


def parse_feed(xml_bytes: bytes, limit: int) -> list[tuple[str, str, str]]:
    root = ET.fromstring(xml_bytes)
    posts: list[tuple[str, str, str]] = []
    for item in root.iter("item"):  # RSS
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if title and link:
            posts.append((title, link, parse_date(item.findtext("pubDate"))))
    if not posts:
        for entry in root.iter(f"{ATOM}entry"):  # Atom
            title = (entry.findtext(f"{ATOM}title") or "").strip()
            link_el = entry.find(f"{ATOM}link")
            link = (link_el.get("href") if link_el is not None else "") or ""
            if title and link:
                posts.append((title, link, parse_date(entry.findtext(f"{ATOM}updated") or entry.findtext(f"{ATOM}published"))))
    return posts[:limit]


def render(posts: list[tuple[str, str, str]]) -> str:
    esc = lambda s: s.replace("[", "\\[").replace("]", "\\]")
    lines = [f"- [{esc(t)}]({l})" + (f" <sub>· {d}</sub>" if d else "") for t, l, d in posts]
    return "\n".join(lines)


def main() -> int:
    readme = sys.argv[1] if len(sys.argv) > 1 else "README.md"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    url = os.getenv("BLOG_FEED_URL", "https://mernstackdev.com/feed")
    try:
        posts = parse_feed(fetch(url), limit)
    except Exception as e:
        print(f"Could not read feed {url}: {e}. README left unchanged.")
        return 0
    if not posts:
        print("Feed had no posts. README left unchanged.")
        return 0
    text = open(readme, encoding="utf-8").read()
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)
    if not pattern.search(text):
        print("Markers not found in README. Add BLOG-POSTS:START/END comments.")
        return 1
    new = pattern.sub(f"{START}\n{render(posts)}\n{END}", text)
    if new != text:
        open(readme, "w", encoding="utf-8").write(new)
        print(f"Updated README with {len(posts)} posts.")
    else:
        print("No changes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
