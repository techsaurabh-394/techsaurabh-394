#!/usr/bin/env python3
"""Generate self-hosted GitHub stats cards (no third-party widget services).

Writes assets/stats.svg and assets/langs.svg using the GitHub GraphQL API.
Usage: GH_TOKEN=... python scripts/generate_stats.py [username]
"""
import json
import os
import sys
import urllib.request
from collections import Counter

USER = sys.argv[1] if len(sys.argv) > 1 else "techsaurabh-394"
TOKEN = os.environ["GH_TOKEN"]
BG, BORDER, TITLE, TEXT, MUTED, ACCENT = "#0D1117", "#30363D", "#2DD4BF", "#C9D1D9", "#8B949E", "#FBBF24"

QUERY = """
query($login:String!){
  user(login:$login){
    followers{totalCount}
    pullRequests{totalCount}
    issues{totalCount}
    repositoriesContributedTo(first:1, contributionTypes:[COMMIT,PULL_REQUEST,ISSUE,REPOSITORY]){totalCount}
    createdAt
    repositories(ownerAffiliations:OWNER, isFork:false, first:100, orderBy:{field:STARGAZERS, direction:DESC}){
      totalCount
      nodes{stargazerCount languages(first:10, orderBy:{field:SIZE, direction:DESC}){edges{size node{name color}}}}
    }
  }
}"""


def gql():
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": QUERY, "variables": {"login": USER}}).encode(),
        headers={"Authorization": f"bearer {TOKEN}", "User-Agent": "stats-gen"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    if "errors" in d:
        raise SystemExit(d["errors"])
    return d["data"]["user"]


def all_time(created_year):
    """Sum contributions for every year since signup (API allows 1 year per query)."""
    from datetime import datetime
    tot = {"commits": 0, "prs": 0, "issues": 0, "reviews": 0, "private": 0}
    for y in range(created_year, datetime.utcnow().year + 1):
        q = ('query($l:String!){user(login:$l){contributionsCollection(from:"%d-01-01T00:00:00Z",to:"%d-12-31T23:59:59Z")'
             '{totalCommitContributions totalPullRequestContributions totalIssueContributions '
             'totalPullRequestReviewContributions restrictedContributionsCount}}}' % (y, y))
        req = urllib.request.Request("https://api.github.com/graphql",
            data=json.dumps({"query": q, "variables": {"l": USER}}).encode(),
            headers={"Authorization": f"bearer {TOKEN}", "User-Agent": "stats-gen"})
        c = json.load(urllib.request.urlopen(req, timeout=30))["data"]["user"]["contributionsCollection"]
        tot["commits"] += c["totalCommitContributions"]; tot["prs"] += c["totalPullRequestContributions"]
        tot["issues"] += c["totalIssueContributions"]; tot["reviews"] += c["totalPullRequestReviewContributions"]
        tot["private"] += c["restrictedContributionsCount"]
    tot["all"] = sum(tot[k] for k in ("commits", "prs", "issues", "reviews", "private"))
    return tot


def card(w, h, title, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
        f'font-family="\'Segoe UI\', Ubuntu, Helvetica, Arial, sans-serif">'
        f'<rect x="0.5" y="0.5" rx="6" width="{w-1}" height="{h-1}" fill="{BG}" stroke="{BORDER}"/>'
        f'<text x="25" y="35" font-size="18" font-weight="600" fill="{TITLE}">{title}</text>{body}</svg>'
    )


def main():
    u = gql()
    repos = u["repositories"]["nodes"]
    stars = sum(r["stargazerCount"] for r in repos)
    a = all_time(int(u["createdAt"][:4]))
    commits = a["commits"] + a["private"]
    rows = [
        ("Total stars", stars), ("Total commits (all time)", commits), ("Total contributions", a["all"]),
        ("Pull requests", u["pullRequests"]["totalCount"]),
        ("Contributed to", u["repositoriesContributedTo"]["totalCount"]),
        
    ]
    body = ""
    for i, (k, v) in enumerate(rows):
        y = 68 + i * 25
        body += (f'<circle cx="32" cy="{y-5}" r="4" fill="{ACCENT}"/>'
                 f'<text x="46" y="{y}" font-size="14" fill="{TEXT}">{k}</text>'
                 f'<text x="300" y="{y}" font-size="14" font-weight="600" fill="{TEXT}" text-anchor="end">{v:,}</text>')
    open("assets/stats.svg", "w").write(card(330, 68 + len(rows) * 25 + 12, f"{USER} GitHub Stats", body))

    langs, colors = Counter(), {}
    for r in repos:
        for e in r["languages"]["edges"]:
            langs[e["node"]["name"]] += e["size"]
            colors[e["node"]["name"]] = e["node"]["color"] or "#8B949E"
    top = langs.most_common(6)
    total = sum(v for _, v in top) or 1
    body, x = "", 25
    for n, v in top:  # stacked bar
        wd = 280 * v / total
        body += f'<rect x="{x:.1f}" y="52" width="{wd:.1f}" height="8" fill="{colors[n]}"/>'
        x += wd
    body = f'<clipPath id="c"><rect x="25" y="52" width="280" height="8" rx="4"/></clipPath><g clip-path="url(#c)">{body}</g>'
    for i, (n, v) in enumerate(top):
        cx, cy = 25 + (i % 2) * 150, 90 + (i // 2) * 25
        body += (f'<circle cx="{cx+5}" cy="{cy-5}" r="5" fill="{colors[n]}"/>'
                 f'<text x="{cx+16}" y="{cy}" font-size="13" fill="{TEXT}">{n} <tspan fill="{MUTED}">{100*v/total:.1f}%</tspan></text>')
    open("assets/langs.svg", "w").write(card(330, 90 + ((len(top) + 1) // 2) * 25 + 5, "Most Used Languages", body))
    print("stars", stars, "commits", commits, a, "langs", top)


main()
