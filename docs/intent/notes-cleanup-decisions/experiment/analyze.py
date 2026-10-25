"""Score experiment results against reference labels. Writes analysis.json and prints a report."""
import json, os, statistics as st, itertools, importlib.util
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("q", os.path.join(HERE, "questions.py"))
Q = importlib.util.module_from_spec(spec); spec.loader.exec_module(Q)
DATA = json.load(open(os.path.join(HERE, "states.json")))
NOTES = {n["id"]: n for n in DATA["notes"]}
REF_FILE = os.environ.get("REF", "labels_claude.json")
REF = json.load(open(os.path.join(HERE, REF_FILE)))
QS = {q["id"]: q for q in Q.NOTE_QUESTIONS}
REF_KEY = {"worth_reading": "worth_reading"}
SCORE_MAP = {  # reference label names -> question level ids
    "tech_staleness": {"no_technical_advice": "no_technical_advice", "advice_on_tools_still_standard": "tools_still_standard",
                       "mentions_some_tools_now_replaced": "some_tools_replaced",
                       "centers_on_tools_now_replaced_or_abandoned": "centers_on_replaced"},
    "length_fit": {"too_little_to_be_useful": "too_little", "short_and_complete": "short_complete",
                   "long_because_of_many_entries_or_rows": "long_entries", "long_with_repetition_or_chat_filler": "long_filler"},
}


def load(name):
    p = os.path.join(HERE, "results", name + ".jsonl")
    return {json.loads(l)["key"]: json.loads(l) for l in open(p)} if os.path.exists(p) else {}


def auc(pos, neg):
    if not pos or not neg: return None
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def label_of(qid, a):
    """Decision-API answer -> discrete label."""
    q = QS[qid]
    if q["type"] == "noul": return a["p"] >= 0.5
    if q["type"] == "choice": return a["choice"]
    levels = [k for k, _ in q["levels"]]
    return levels[min(len(levels) - 1, int(round(a["score"])))]


def ref_label(qid, r):
    v = r[qid]
    return SCORE_MAP.get(qid, {}).get(v, v)


def per_question(res, kind="decision", ids=None):
    out = {}
    for qid, q in QS.items():
        agree = n = 0; pos = []; neg = []
        for nid, r in res.items():
            if nid not in REF or (ids and nid not in ids): continue
            a = r["answers"][qid]
            ref = ref_label(qid, REF[nid])
            lab = a if kind == "llm" else label_of(qid, a)
            if kind == "llm" and q["type"] == "score": lab = a
            n += 1; agree += (lab == ref)
            if kind != "llm" and q["type"] == "noul":
                (pos if ref else neg).append(a["p"])
        out[qid] = {"agree": round(agree / n, 3) if n else None, "n": n,
                    "auc": round(auc(pos, neg), 3) if pos and neg else None, "pos_rate": round(len(pos) / n, 2) if n else None}
    return out


def stability(a, b):
    """noul mean |dp|, choice/score label flips between two runs."""
    dps, flips = [], Counter()
    for k in a:
        if k not in b: continue
        for qid, q in QS.items():
            if qid not in a[k]["answers"] or qid not in b[k]["answers"]: continue
            x, y = a[k]["answers"][qid], b[k]["answers"][qid]
            if q["type"] == "noul": dps.append(abs(x["p"] - y["p"])); flips[qid] += (x["p"] >= .5) != (y["p"] >= .5)
            else: flips[qid] += label_of(qid, x) != label_of(qid, y)
    return {"noul_mean_abs_dp": round(st.mean(dps), 4) if dps else None, "flips": dict(flips)}


# ---- verdict from atomic answers (code decides) ---------------------------------
def verdict(nid, a, th):
    n = NOTES[nid]
    if n["in_collection"]: return "keep"
    P = lambda q: a[q]["p"]
    problem = max(P("empty_or_stub"), P("import_junk"))
    ta = a["time_anchor"]["probs"]
    dated = (ta.get("one_event", 0) + ta.get("period_plan", 0))
    expired = bool(n["facts"]["latest_date_is_past"]) and dated > th["dated"]
    if problem > th["problem"] and P("worth_reading") < th["worth"]: return "delete"
    if expired and P("evergreen_core") < th["evergreen"]: return "archive"
    if P("is_todo") > th["todo"]: return "make_task"
    if P("rederivable") > th["rederiv"] and P("author_specific") < th["specific"]:
        return "delete" if P("worth_reading") < th["worth"] else "archive"
    if expired: return "keep_but_trim"
    if P("worth_reading") < th["worth"] * 0.6: return "archive"
    return "keep"


COARSE = {"delete": "drop", "archive": "drop", "keep": "keep", "keep_but_trim": "keep", "make_task": "task"}
DEFAULT_TH = dict(problem=0.6, worth=0.5, dated=0.6, evergreen=0.4, todo=0.6, rederiv=0.6, specific=0.4)


def verdict_score(res, ids, th):
    exact = coarse = n = 0; conf = Counter()
    for nid in ids:
        if nid not in res or nid not in REF: continue
        v = verdict(nid, res[nid]["answers"], th); r = REF[nid]["verdict"]
        n += 1; exact += v == r; coarse += COARSE[v] == COARSE[r]; conf[(r, v)] += 1
    return {"n": n, "exact": round(exact / n, 3), "coarse": round(coarse / n, 3), "confusion": {f"{a}->{b}": c for (a, b), c in conf.items()}}


def tune(res, ids):
    grid = dict(problem=[.5, .6, .7], worth=[.4, .5, .6], dated=[.5, .6], evergreen=[.3, .4, .5],
                todo=[.5, .6, .7], rederiv=[.5, .6, .7], specific=[.3, .4, .5])
    best = None
    for vals in itertools.product(*grid.values()):
        th = dict(zip(grid, vals)); s = verdict_score(res, ids, th)
        key = (s["coarse"], s["exact"])
        if not best or key > best[0]: best = (key, th)
    return best[1]


def llm_verdict(nid, a):
    n = NOTES[nid]
    if n["in_collection"]: return "keep"
    if (a["empty_or_stub"] or a["import_junk"]) and not a["worth_reading"]: return "delete"
    expired = bool(n["facts"]["latest_date_is_past"]) and a["time_anchor"] in ("one_event", "period_plan")
    if expired and not a["evergreen_core"]: return "archive"
    if a["is_todo"]: return "make_task"
    if a["rederivable"] and not a["author_specific"]: return "delete" if not a["worth_reading"] else "archive"
    if expired: return "keep_but_trim"
    return "keep" if a["worth_reading"] else "archive"


def main():
    rep = {}
    dev = {k for k, n in NOTES.items() if n["split"] == "dev"}
    hold = {k for k, n in NOTES.items() if n["split"] == "holdout"}
    runs = {v: load(f"{v}__note") for v in ("jev", "openai")}
    llm = load("openai__llm")
    for v, res in runs.items():
        rep[f"{v}_per_question"] = per_question(res)
        rep[f"{v}_self_consistency"] = stability(res, load(f"{v}__note_rep"))
        rep[f"{v}_order_flips"] = stability(res, load(f"{v}__note_rev"))["flips"]
        lat = sorted(r["latency"] for r in res.values())
        rep[f"{v}_latency"] = {"p50": round(lat[len(lat) // 2], 3), "p95": round(lat[int(len(lat) * .95)], 3)}
        rep[f"{v}_cost_per_1k_notes"] = round(sum(r["cost"] for r in res.values()) / len(res) * 1000, 4)
        rep[f"{v}_tokens_mean"] = round(st.mean(r["tokens"] for r in res.values()))
        rep[f"{v}_verdict_default_all"] = verdict_score(res, NOTES, DEFAULT_TH)
        th = tune(res, dev)
        rep[f"{v}_tuned_th"] = th
        rep[f"{v}_verdict_tuned_dev"] = verdict_score(res, dev, th)
        rep[f"{v}_verdict_tuned_holdout"] = verdict_score(res, hold, th)
    rep["llm_per_question"] = per_question(llm, kind="llm")
    lat = sorted(r["latency"] for r in llm.values())
    rep["llm_latency"] = {"p50": round(lat[len(lat) // 2], 2), "p95": round(lat[int(len(lat) * .95)], 2)}
    rep["llm_cost_per_1k_notes"] = round(sum(r["cost"] for r in llm.values()) / len(llm) * 1000, 4)
    lv = Counter(); lc = Counter(); n = 0
    for nid, r in llm.items():
        v = llm_verdict(nid, r["answers"]); ref = REF[nid]["verdict"]; n += 1
        lv["exact"] += v == ref; lc["coarse"] += COARSE[v] == COARSE[ref]
    rep["llm_verdict_all"] = {"exact": round(lv["exact"] / n, 3), "coarse": round(lc["coarse"] / n, 3)}
    # vendor agreement
    agree = Counter(); tot = 0
    for k in runs["jev"]:
        tot += 1
        for qid in QS: agree[qid] += label_of(qid, runs["jev"][k]["answers"][qid]) == label_of(qid, runs["openai"][k]["answers"][qid])
    rep["jev_vs_openai_agree"] = {q: round(c / tot, 3) for q, c in agree.items()}
    # pairs
    for v in ("jev", "openai"):
        pr = load(f"{v}__pairs"); rows = []
        titles = {n["id"]: n["title"] for n in NOTES.values()}
        exp = {(a, b): e for a, b, e in Q.PAIRS}
        lv = [k for k, _ in Q.PAIR_QUESTIONS[0]["levels"]]
        hit = 0
        for k, r in pr.items():
            a, b = k.split("|"); ta, tb = titles[a], titles[b]
            got = lv[int(round(r["answers"]["relation"]["score"]))]
            e = exp[(ta, tb)]; hit += got == e
            rows.append({"a": ta, "b": tb, "expected": e, "got": got, "score": r["answers"]["relation"]["score"],
                         "a_covers_b": r["answers"]["a_covers_b"]["p"], "b_covers_a": r["answers"]["b_covers_a"]["p"],
                         "together": r["answers"]["better_together"]["p"]})
        neg = [x["score"] for x in rows if x["expected"] == "shares_words_only"]
        posi = [x["score"] for x in rows if x["expected"] != "shares_words_only"]
        rep[f"{v}_pairs"] = {"exact": round(hit / len(rows), 3), "auc_related_vs_not": round(auc(posi, neg), 3), "rows": rows}
    # sections
    for v in ("jev", "openai"):
        sr = load(f"{v}__sections"); cands = []
        for k, r in sr.items():
            n_sec = len(NOTES[k]["sections"])
            off = sum(1 for i in range(n_sec) if r["answers"][f"same_subject_{i}"]["p"] < .5 and r["answers"][f"standalone_{i}"]["p"] >= .5)
            if off >= 2: cands.append((NOTES[k]["title"], off, n_sec))
        rep[f"{v}_split_candidates"] = cands
    json.dump(rep, open(os.path.join(HERE, "analysis.json"), "w"), indent=1, default=str)
    return rep


if __name__ == "__main__":
    rep = main()
    for k in ("jev", "openai"):
        print(f"\n== {k}: latency {rep[k+'_latency']} cost/1k ${rep[k+'_cost_per_1k_notes']} tokens {rep[k+'_tokens_mean']}")
        print("self-consistency", rep[k + "_self_consistency"])
        print("order flips (choices reversed)", rep[k + "_order_flips"])
        for q, s in rep[k + "_per_question"].items(): print(f"  {q:16} agree {s['agree']}  auc {s['auc']}  pos {s['pos_rate']}")
        for s in ("verdict_default_all", "verdict_tuned_dev", "verdict_tuned_holdout"):
            x = rep[f"{k}_{s}"]; print(f"  {s}: n={x['n']} exact {x['exact']} coarse {x['coarse']}")
        print("  tuned", rep[k + "_tuned_th"])
        p = rep[k + "_pairs"]; print(f"  pairs exact {p['exact']} auc {p['auc_related_vs_not']}")
        print("  split candidates", rep[k + "_split_candidates"])
    print("\n== llm", rep["llm_latency"], "cost/1k", rep["llm_cost_per_1k_notes"], rep["llm_verdict_all"])
    for q, s in rep["llm_per_question"].items(): print(f"  {q:16} agree {s['agree']}")
    print("\njev vs openai agreement", rep["jev_vs_openai_agree"])
