#!/usr/bin/env python3
"""Write the latest blog posts into README.md between the BLOG-POSTS markers.

Your feed titles currently look like "How to Use: Complete Guide 2024 | Tutorials & Examples"
(an SEO template overwrote them). When a title looks like that, a clean one is rebuilt from
the post's URL slug instead, e.g. /mysql-json-functions-for-dynamic-data/ becomes
"MySQL JSON Functions for Dynamic Data".

Usage: python scripts/update_blog.py [feed_url]
"""
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from html import unescape

FEED = sys.argv[1] if len(sys.argv) > 1 else "https://mernstackdev.com/feed/"
README = "README.md"
LIMIT = 5

JUNK = re.compile(r"complete guide 20\d\d|\|\s*tutorials", re.I)
WORDS = {
    "ai": "AI", "api": "API", "apis": "APIs", "mcp": "MCP", "rag": "RAG", "llm": "LLM", "llms": "LLMs",
    "json": "JSON", "mysql": "MySQL", "sql": "SQL", "css": "CSS", "html": "HTML", "jwt": "JWT",
    "graphql": "GraphQL", "mongodb": "MongoDB", "postgresql": "PostgreSQL", "typescript": "TypeScript",
    "javascript": "JavaScript", "github": "GitHub", "gcp": "GCP", "aws": "AWS", "ui": "UI", "ux": "UX",
    "ci": "CI", "cd": "CD", "openai": "OpenAI", "nextjs": "Next.js", "nodejs": "Node.js", "vs": "vs",
}
JOINED = {("node", "js"): "Node.js", ("next", "js"): "Next.js", ("react", "js"): "React.js",
          ("vue", "js"): "Vue.js", ("express", "js"): "Express.js", ("nest", "js"): "NestJS"}
SMALL = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "vs"}


def title_from_slug(url):
    parts = [p for p in url.rstrip("/").rsplit("/", 1)[-1].split("-") if p]
    out, i = [], 0
    while i < len(parts):
        pair = tuple(parts[i:i + 2])
        if pair in JOINED:
            out.append(JOINED[pair]); i += 2; continue
        w = parts[i]
        if w in WORDS:
            out.append(WORDS[w])
        elif w in SMALL and out:
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:])
        i += 1
    return " ".join(out)


def main():
    req = urllib.request.Request(FEED, headers={"User-Agent": "Mozilla/5.0 profile-readme"})
    root = ET.fromstring(urllib.request.urlopen(req, timeout=30).read())
    lines = []
    for item in root.iter("item"):
        link = (item.findtext("link") or "").strip()
        title = unescape((item.findtext("title") or "").strip())
        if not link:
            continue
        if not title or JUNK.search(title):
            title = title_from_slug(link)
        when = item.findtext("pubDate")
        date = f" <sub>· {parsedate_to_datetime(when):%b %d, %Y}</sub>" if when else ""
        lines.append(f"- [{title.replace(']', ')')}]({link}){date}")
        if len(lines) == LIMIT:
            break
    if not lines:
        raise SystemExit("No posts found in feed; README left unchanged.")

    text = open(README, encoding="utf-8").read()
    new = re.sub(r"(<!-- BLOG-POSTS:START -->).*?(<!-- BLOG-POSTS:END -->)",
                 lambda m: f"{m[1]}\n" + "\n".join(lines) + f"\n{m[2]}", text, flags=re.S)
    if new != text:
        open(README, "w", encoding="utf-8").write(new)
    print("\n".join(lines))


if __name__ == "__main__":
    main()
