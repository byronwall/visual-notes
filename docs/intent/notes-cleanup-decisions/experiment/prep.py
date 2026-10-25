"""Build per-note decision state from raw notes.json (code-side facts, cleaned body)."""
import json, re, sys, hashlib
from datetime import date

TODAY = date(2026, 10, 24)
BODY_CAP = 20000  # chars (~5k tokens); head 15k + tail 5k when longer
MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}

OWNER = {
    "about": "Byron: senior full-stack developer in Indianapolis (TypeScript, SolidJS, data viz, stats). "
             "Family with young kids. Hobbies: house projects and repairs, woodworking, electronics, Bible study. "
             "Builds his own tools, including this notes app.",
    "keeps": "Things he wrote or decided himself: logs of what he did, project notes and build logs, measurements, "
             "model numbers, hard-won fixes, plans still in progress, personal opinions and lessons, family records.",
    "drops": "Generic explanations anyone could re-ask a chatbot or search for, plans and quotes for dates that have "
             "passed with nothing reusable, empty captures, leftovers from importing other tools.",
}

DATE_PATTERNS = [
    (re.compile(r"\b(20[12]\d)-(\d{2})-(\d{2})"), "ymd"),
    (re.compile(r"\b(\d{1,2})/(\d{1,2})/(20[12]\d)\b"), "mdy"),
    (re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20[12]\d)\b", re.I), "Mdy"),
    (re.compile(r"\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(20[12]\d)\b", re.I), "dMy"),
]


def find_dates(text):
    out = []
    for pat, kind in DATE_PATTERNS:
        for m in pat.finditer(text):
            try:
                if kind == "ymd":
                    d = date(int(m[1]), int(m[2]), int(m[3]))
                elif kind == "mdy":
                    d = date(int(m[3]), int(m[1]), int(m[2]))
                elif kind == "Mdy":
                    d = date(int(m[3]), MONTHS[m[1][:3].lower()], int(m[2]))
                else:
                    d = date(int(m[3]), MONTHS[m[2][:3].lower()], int(m[1]))
                out.append(d)
            except (ValueError, KeyError):
                pass
    return out


def clean(md):
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", "[image]", md)
    md = re.sub(r"data:[a-z]+/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+", "[data]", md)
    md = re.sub(r"[ \t]*\^[A-Za-z0-9]{10}[ \t]*$", "", md, flags=re.M)  # block id tags
    md = re.sub(r"\(__NOTION__[^)]*\)", "(notion-link)", md)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def source_of(n, body):
    if n.get("createdBy") == "agent":
        return "agent"
    if re.search(r"Link back:\*?\s*\[?https://chatgpt\.com", body):
        return "chatgpt_transcript"
    if n.get("createdAt", "").startswith("2025-10-2"):
        return "bulk_import"
    return "user"


def sections_of(body):
    parts = re.split(r"\n(?=#{1,2} )", body)
    secs = [p.strip() for p in parts if p.strip()]
    # drop a bare title heading
    if secs and re.fullmatch(r"#\s+.*", secs[0]):
        secs = secs[1:]
    return secs[:12]


def build(n):
    raw = n["markdown"]
    body = clean(raw)
    words = len(re.findall(r"\w+", body))
    dates = [d for d in find_dates(body) if date(2010, 1, 1) <= d <= date(2028, 12, 31)]
    latest = max(dates) if dates else None
    truncated = len(body) > BODY_CAP
    sent = body if not truncated else body[:15000] + "\n\n[… middle of note omitted …]\n\n" + body[-5000:]
    secs = sections_of(body)
    return {
        "id": n["id"],
        "title": n["title"],
        "path": n.get("path"),
        "in_collection": bool(n.get("collection")),
        "facts": {
            "source": source_of(n, body),
            "path": n.get("path") or "(unfiled)",
            "created": n.get("createdAt", "")[:10],
            "words": words,
            "headings": len(re.findall(r"^#{1,3} ", body, flags=re.M)),
            "links": len(re.findall(r"https?://", body)),
            "images": body.count("[image]"),
            "latest_date_in_body": latest.isoformat() if latest else None,
            "latest_date_is_past": (latest < TODAY) if latest else None,
            "truncated": truncated,
        },
        "body": sent,
        "sections": [s[:3000] for s in secs] if len(secs) >= 3 else [],
        "split": "holdout" if int(hashlib.sha1(n["id"].encode()).hexdigest(), 16) % 3 == 0 else "dev",
    }


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    notes = json.load(open(src))
    out = [build(n) for n in notes]
    json.dump({"owner": OWNER, "today": TODAY.isoformat(), "notes": out}, open(dst, "w"), indent=1)
    from collections import Counter
    print(len(out), Counter(o["facts"]["source"] for o in out), Counter(o["split"] for o in out))
    print("with sections:", sum(1 for o in out if o["sections"]), "truncated:", sum(o["facts"]["truncated"] for o in out))
