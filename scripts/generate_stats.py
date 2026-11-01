#!/usr/bin/env python3
"""Generate self-hosted GitHub profile cards and the open-source contributions table.

Writes:
  assets/stats.svg     all-time numbers (commits, merged PRs, reviews, stars, ...)
  assets/langs.svg     most used languages across your own repos
  assets/activity.svg  weekly contributions for the last 12 months + streaks
  README.md            table between <!-- OSS:START --> and <!-- OSS:END -->

Usage:
  GH_TOKEN=... python scripts/generate_stats.py [username]
  python scripts/generate_stats.py --demo          # fake data, no token, for previewing
"""
import json
import os
import random
import re
import sys
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from xml.sax.saxutils import escape

USER = next((a for a in sys.argv[1:] if not a.startswith("--")), "techsaurabh-394")
DEMO = "--demo" in sys.argv
README = "README.md"
OSS_LIMIT = 8

BG, BORDER, TEAL, AMBER = "#0D1117", "#30363D", "#2DD4BF", "#FBBF24"
TEXT, MUTED, EMPTY = "#E6EDF3", "#8B949E", "#21262D"
FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', Arial, sans-serif"


# --------------------------------------------------------------------------- data

def gql(query, variables=None):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"Authorization": f"bearer {os.environ['GH_TOKEN']}", "User-Agent": "profile-stats"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    if d.get("errors"):
        raise SystemExit(f"GitHub API error: {d['errors']}")
    return d["data"]


PROFILE_Q = """
query($login:String!){
  user(login:$login){
    createdAt
    pullRequests(states:MERGED){totalCount}
    repositories(ownerAffiliations:OWNER, isFork:false, first:100, orderBy:{field:STARGAZERS, direction:DESC}){
      nodes{stargazerCount languages(first:10, orderBy:{field:SIZE, direction:DESC}){edges{size node{name color}}}}
    }
    contributionsCollection{
      contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}
    }
    mergedPRs: pullRequests(states:MERGED, first:100, orderBy:{field:CREATED_AT, direction:DESC}){
      nodes{repository{nameWithOwner url description stargazerCount owner{login}}}
    }
    repositoriesContributedTo(first:50, includeUserRepositories:false,
                              contributionTypes:[COMMIT, PULL_REQUEST, PULL_REQUEST_REVIEW]){
      nodes{nameWithOwner url description stargazerCount owner{login}}
    }
  }
}"""


def all_time_totals(created_year):
    """One query with an alias per year (the API limits each window to one year)."""
    now = datetime.now(timezone.utc)
    parts = []
    for y in range(created_year, now.year + 1):
        end = now.strftime("%Y-%m-%dT%H:%M:%SZ") if y == now.year else f"{y}-12-31T23:59:59Z"
        parts.append(
            f'y{y}: contributionsCollection(from:"{y}-01-01T00:00:00Z", to:"{end}")'
            "{totalCommitContributions totalPullRequestContributions totalIssueContributions "
            "totalPullRequestReviewContributions restrictedContributionsCount}"
        )
    data = gql("query($l:String!){user(login:$l){%s}}" % " ".join(parts), {"l": USER})["user"]
    tot = Counter()
    for c in data.values():
        tot["commits"] += c["totalCommitContributions"]
        tot["prs"] += c["totalPullRequestContributions"]
        tot["issues"] += c["totalIssueContributions"]
        tot["reviews"] += c["totalPullRequestReviewContributions"]
        tot["private"] += c["restrictedContributionsCount"]
    tot["all"] = sum(tot[k] for k in ("commits", "prs", "issues", "reviews", "private"))
    return tot


def demo_data():
    rnd = random.Random(394)
    start = date.today() - timedelta(days=364 + date.today().isoweekday() % 7)
    days = [{"date": (start + timedelta(i)).isoformat(),
             "contributionCount": rnd.choice([0] * 6 + [1, 2, 3, 5])} for i in range((date.today() - start).days + 1)]
    weeks = [{"contributionDays": days[i:i + 7]} for i in range(0, len(days), 7)]
    repo = lambda n, d, s: {"nameWithOwner": n, "url": f"https://github.com/{n}", "description": d,
                            "stargazerCount": s, "owner": {"login": n.split("/")[0]}}
    langs = [("Python", "#3572A5", 60), ("TypeScript", "#3178c6", 25), ("JavaScript", "#f1e05a", 8),
             ("HTML", "#e34c26", 4), ("CSS", "#563d7c", 2), ("Shell", "#89e051", 1)]
    user = {
        "createdAt": "2021-03-01T00:00:00Z",
        "pullRequests": {"totalCount": 41},
        "repositories": {"nodes": [{"stargazerCount": 4, "languages": {"edges": [
            {"size": s * 1000, "node": {"name": n, "color": c}} for n, c, s in langs]}}]},
        "contributionsCollection": {"contributionCalendar": {
            "totalContributions": sum(d["contributionCount"] for d in days), "weeks": weeks}},
        "mergedPRs": {"nodes": [{"repository": repo("Azure/azure-cli", "Azure Command-Line Interface", 4700)}] * 3
                      + [{"repository": repo("makecindy/cindy", "Cindy agent framework", 120)}]},
        "repositoriesContributedTo": {"nodes": [repo("Automattic/wp-calypso", "The JavaScript and API powered WordPress.com", 12500)]},
    }
    return user, Counter(commits=512, prs=41, issues=17, reviews=23, private=88, all=681)


# --------------------------------------------------------------------------- svg helpers

def card(w, h, title, body, subtitle=""):
    sub = f'<text x="{w-25}" y="35" font-size="12" fill="{MUTED}" text-anchor="end">{escape(subtitle)}</text>' if subtitle else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" font-family="{FONT}">'
            f'<title>{escape(title)}</title>'
            f'<rect x="0.5" y="0.5" rx="10" width="{w-1}" height="{h-1}" fill="{BG}" stroke="{BORDER}"/>'
            f'<text x="25" y="36" font-size="17" font-weight="600" fill="{TEAL}">{escape(title)}</text>{sub}{body}</svg>')


def human(n):
    return f"{n/1000:.1f}k".replace(".0k", "k") if n >= 1000 else f"{n:,}"


def write(path, svg):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)


# --------------------------------------------------------------------------- cards

def stats_card(rows):
    body = ""
    for i, (label, value) in enumerate(rows):
        y = 74 + i * 27
        body += (f'<rect x="25" y="{y-11}" width="4" height="14" rx="2" fill="{AMBER}"/>'
                 f'<text x="40" y="{y}" font-size="14" fill="{TEXT}">{escape(label)}</text>'
                 f'<text x="395" y="{y}" font-size="14" font-weight="700" fill="{TEXT}" text-anchor="end">{escape(value)}</text>')
    return card(420, 210, "GitHub stats", body, "all time")


def langs_card(repos):
    langs, colors = Counter(), {}
    for r in repos:
        for e in r["languages"]["edges"]:
            langs[e["node"]["name"]] += e["size"]
            colors[e["node"]["name"]] = e["node"]["color"] or MUTED
    top = langs.most_common(6)
    total = sum(v for _, v in top) or 1
    bar, x = "", 25.0
    for n, v in top:
        wd = 370 * v / total
        bar += f'<rect x="{x:.1f}" y="58" width="{wd:.1f}" height="10" fill="{colors[n]}"/>'
        x += wd
    body = (f'<clipPath id="lc"><rect x="25" y="58" width="370" height="10" rx="5"/></clipPath>'
            f'<g clip-path="url(#lc)">{bar}</g>')
    for i, (n, v) in enumerate(top):
        cx, cy = 25 + (i % 2) * 190, 104 + (i // 2) * 30
        body += (f'<circle cx="{cx+6}" cy="{cy-5}" r="6" fill="{colors[n]}"/>'
                 f'<text x="{cx+20}" y="{cy}" font-size="14" fill="{TEXT}">{escape(n)}'
                 f' <tspan fill="{MUTED}">{100*v/total:.1f}%</tspan></text>')
    return card(420, 210, "Most used languages", body, "own repos, by size"), top


def streaks(days):
    counts = [d["contributionCount"] for d in days]
    i = len(counts) - 1
    if counts and counts[i] == 0:  # today may not have a contribution yet
        i -= 1
    current = 0
    while i >= 0 and counts[i] > 0:
        current, i = current + 1, i - 1
    longest = run = 0
    for c in counts:
        run = run + 1 if c else 0
        longest = max(longest, run)
    active = sum(1 for c in counts if c)
    return current, longest, active


def activity_card(calendar):
    weeks = calendar["weeks"][-53:]
    days = [d for w in weeks for d in w["contributionDays"]]
    current, longest, active = streaks(days)
    weekly = [sum(d["contributionCount"] for d in w["contributionDays"]) for w in weeks]
    peak = max(weekly) or 1

    # left column: headline numbers
    stats = [(f'{calendar["totalContributions"]:,}', "contributions"),
             (f"{current} d", "current streak"),
             (f"{longest} d", "longest streak"),
             (f"{active}", "active days")]
    body = ""
    for i, (num, label) in enumerate(stats):
        x, y = 25 + (i % 2) * 120, 82 + (i // 2) * 62
        body += (f'<text x="{x}" y="{y}" font-size="24" font-weight="700" fill="{TEXT if i else AMBER}">{num}</text>'
                 f'<text x="{x}" y="{y+20}" font-size="12" fill="{MUTED}">{label}</text>')

    # right: weekly bar chart
    x0, base, h, slot = 275, 172, 108, 590 / len(weekly)
    body += f'<line x1="{x0}" y1="{base+0.5}" x2="{x0 + slot*len(weekly)}" y2="{base+0.5}" stroke="{BORDER}"/>'
    last_month = None
    for i, (w, total) in enumerate(zip(weeks, weekly)):
        x = x0 + i * slot
        if total:
            bh = max(4, h * total / peak)
            body += (f'<rect x="{x+1:.1f}" y="{base-bh:.1f}" width="{slot-2.5:.1f}" height="{bh:.1f}" rx="2" '
                     f'fill="{TEAL}" fill-opacity="{0.45 + 0.55*total/peak:.2f}"><title>{total} in week of '
                     f'{w["contributionDays"][0]["date"]}</title></rect>')
        else:
            body += f'<rect x="{x+1:.1f}" y="{base-3}" width="{slot-2.5:.1f}" height="3" rx="1" fill="{EMPTY}"/>'
        month = date.fromisoformat(w["contributionDays"][0]["date"]).strftime("%b")
        if month != last_month and i < len(weekly) - 2:
            if last_month is not None:
                body += f'<text x="{x+1:.1f}" y="{base+18}" font-size="11" fill="{MUTED}">{month}</text>'
            last_month = month
    return card(890, 210, "Contribution activity", body, "weekly, last 12 months"), (current, longest)


# --------------------------------------------------------------------------- README table

def oss_table(user):
    repos = {}
    for pr in user["mergedPRs"]["nodes"]:
        r = pr["repository"]
        if r["owner"]["login"].lower() == USER.lower():
            continue
        repos.setdefault(r["nameWithOwner"], {**r, "prs": 0})["prs"] += 1
    for r in user["repositoriesContributedTo"]["nodes"]:
        if r["owner"]["login"].lower() != USER.lower():
            repos.setdefault(r["nameWithOwner"], {**r, "prs": 0})
    ranked = sorted(repos.values(), key=lambda r: (r["prs"] > 0, r["stargazerCount"]), reverse=True)[:OSS_LIMIT]
    if not ranked:
        return "<p align=\"center\"><sub>Contributions to other projects will show up here.</sub></p>"

    rows = []
    for r in ranked:
        desc = (r["description"] or "").replace("|", "/").strip()
        desc = desc if len(desc) <= 70 else desc[:67].rstrip() + "..."
        prs = f'<a href="{r["url"]}/pulls?q=is%3Apr+author%3A{USER}+is%3Amerged">{r["prs"]} merged</a>' if r["prs"] else "commits"
        rows.append(f'<tr><td><a href="{r["url"]}"><b>{escape(r["nameWithOwner"])}</b></a></td>'
                    f'<td>{escape(desc)}</td><td align="right">⭐ {human(r["stargazerCount"])}</td>'
                    f'<td align="right">{prs}</td></tr>')
    return ('<table align="center">\n<tr><th align="left">Project</th><th align="left">About</th>'
            '<th>Stars</th><th>My PRs</th></tr>\n' + "\n".join(rows) + "\n</table>")


def update_readme(block):
    if not os.path.exists(README):
        return
    text = open(README, encoding="utf-8").read()
    new = re.sub(r"(<!-- OSS:START -->).*?(<!-- OSS:END -->)", lambda m: f"{m[1]}\n{block}\n{m[2]}", text, flags=re.S)
    if new != text:
        open(README, "w", encoding="utf-8").write(new)


# --------------------------------------------------------------------------- main

def main():
    if DEMO:
        user, tot = demo_data()
    else:
        user = gql(PROFILE_Q, {"login": USER})["user"]
        tot = all_time_totals(int(user["createdAt"][:4]))

    repos = user["repositories"]["nodes"]
    stars = sum(r["stargazerCount"] for r in repos)
    table = oss_table(user)
    external = table.count("<tr><td>")

    write("assets/stats.svg", stats_card([
        ("Commits", f'{tot["commits"]:,}'),
        ("Merged pull requests", f'{user["pullRequests"]["totalCount"]:,}'),
        ("Code reviews", f'{tot["reviews"]:,}'),
        ("Private contributions", f'{tot["private"]:,}'),
        ("Stars earned", human(stars)),
    ]))
    langs_svg, top = langs_card(repos)
    write("assets/langs.svg", langs_svg)
    activity_svg, (cur, longest) = activity_card(user["contributionsCollection"]["contributionCalendar"])
    write("assets/activity.svg", activity_svg)
    update_readme(table)
    print(f"stars={stars} totals={dict(tot)} streak={cur}/{longest} external_repos={external} langs={top}")


main()
