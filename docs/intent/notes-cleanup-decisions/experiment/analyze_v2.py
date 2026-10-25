"""v2: holistic verdict vs atomic+rules vs atomic+learned weights (drop vs keep)."""
import json, math, os, random, importlib.util
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("a", os.path.join(HERE, "analyze.py"))
A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
NOTES, REF = A.NOTES, A.REF
DROP = {"delete", "archive"}
TASK = {"make_task"}


def feats(nid, a1, a2):
    n = NOTES[nid]; f = n["facts"]; P = lambda q: a1[q]["p"]
    ta = a1["time_anchor"]["probs"]
    dated = ta.get("one_event", 0) + ta.get("period_plan", 0)
    return [
        P("author_specific"), P("rederivable"), P("evergreen_core"), P("empty_or_stub"), P("import_junk"),
        P("is_todo"), P("worth_reading"), P("title_fits"), a2["todo_list"]["p"], a2["copied_or_generated"]["p"],
        a1["length_fit"]["score"] / 3, a1["tech_staleness"]["score"] / 3, dated,
        float(bool(f["latest_date_is_past"]) and dated > .5),
        float(f["source"] == "chatgpt_transcript"), float(f["source"] == "bulk_import"), float(f["source"] == "agent"),
        min(math.log1p(f["words"]) / 9, 1.0), float(n["in_collection"]),
    ]


def fit(X, y, l2=0.05, steps=3000, lr=0.3):
    w = [0.0] * (len(X[0]) + 1)
    for _ in range(steps):
        g = [0.0] * len(w)
        for x, t in zip(X, y):
            z = w[0] + sum(wi * xi for wi, xi in zip(w[1:], x)); p = 1 / (1 + math.exp(-z)); e = p - t
            g[0] += e
            for i, xi in enumerate(x): g[i + 1] += e * xi
        w = [wi - lr * (gi / len(X) + (l2 * wi if i else 0)) for i, (wi, gi) in enumerate(zip(w, g))]
    return w


def pred(w, x): return 1 / (1 + math.exp(-(w[0] + sum(wi * xi for wi, xi in zip(w[1:], x)))))


def run(vendor):
    r1, r2 = A.load(f"{vendor}__note"), A.load(f"{vendor}__note_v2")
    ids = sorted(k for k in r1 if k in r2 and k in REF)
    X = {k: feats(k, r1[k]["answers"], r2[k]["answers"]) for k in ids}
    y = {k: float(REF[k]["verdict"] in DROP) for k in ids}
    dev = [k for k in ids if NOTES[k]["split"] == "dev"]; hold = [k for k in ids if NOTES[k]["split"] == "holdout"]
    out = {}
    # holistic single question
    hv = {k: r2[k]["answers"]["verdict"] for k in ids}
    out["holistic_exact"] = round(sum(hv[k]["choice"] == REF[k]["verdict"] for k in ids) / len(ids), 3)
    out["holistic_coarse"] = round(sum((hv[k]["choice"] in DROP) == (REF[k]["verdict"] in DROP) for k in ids) / len(ids), 3)
    pdrop = {k: hv[k]["probs"].get("delete", 0) + hv[k]["probs"].get("archive", 0) for k in ids}
    out["holistic_drop_auc"] = round(A.auc([pdrop[k] for k in ids if y[k]], [pdrop[k] for k in ids if not y[k]]), 3)
    # learned weights: train dev, test holdout
    w = fit([X[k] for k in dev], [y[k] for k in dev])
    ph = {k: pred(w, X[k]) for k in hold}
    out["learned_holdout_auc"] = round(A.auc([ph[k] for k in hold if y[k]], [ph[k] for k in hold if not y[k]]), 3)
    out["learned_holdout_acc"] = round(sum((ph[k] >= .5) == y[k] for k in hold) / len(hold), 3)
    # leave-one-out over all notes for a steadier number
    loo = {}
    for k in ids:
        tr = [j for j in ids if j != k]
        wk = fit([X[j] for j in tr], [y[j] for j in tr], steps=800)
        loo[k] = pred(wk, X[k])
    out["learned_loo_auc"] = round(A.auc([loo[k] for k in ids if y[k]], [loo[k] for k in ids if not y[k]]), 3)
    out["learned_loo_acc"] = round(sum((loo[k] >= .5) == y[k] for k in ids) / len(ids), 3)
    # precision at the top: if you only review the 30 most-likely-drop notes, how many are drops?
    top = sorted(ids, key=lambda k: -loo[k])
    out["loo_precision_top30"] = round(sum(y[k] for k in top[:30]) / 30, 3)
    out["loo_precision_top60"] = round(sum(y[k] for k in top[:60]) / 60, 3)
    out["base_drop_rate"] = round(sum(y.values()) / len(ids), 3)
    # single-feature baselines (no model): worth_reading alone, rule source==chatgpt
    wr = {k: 1 - r1[k]["answers"]["worth_reading"]["p"] for k in ids}
    out["worth_reading_only_auc"] = round(A.auc([wr[k] for k in ids if y[k]], [wr[k] for k in ids if not y[k]]), 3)
    # todo questions vs reference make_task
    for q, get in (("is_todo", lambda k: r1[k]["answers"]["is_todo"]["p"]), ("todo_list", lambda k: r2[k]["answers"]["todo_list"]["p"])):
        pos = [get(k) for k in ids if REF[k]["verdict"] == "make_task"]; neg = [get(k) for k in ids if REF[k]["verdict"] != "make_task"]
        fp = sum(get(k) >= .5 for k in ids if REF[k]["verdict"] != "make_task")
        out[f"{q}_vs_make_task_auc"] = round(A.auc(pos, neg), 3); out[f"{q}_false_pos"] = fp
    cp = [r2[k]["answers"]["copied_or_generated"]["p"] for k in ids]
    out["copied_auc_vs_ref_not_author_specific"] = round(A.auc(
        [r2[k]["answers"]["copied_or_generated"]["p"] for k in ids if not REF[k]["author_specific"]],
        [r2[k]["answers"]["copied_or_generated"]["p"] for k in ids if REF[k]["author_specific"]]), 3)
    names = ["author_specific", "rederivable", "evergreen_core", "empty_or_stub", "import_junk", "is_todo", "worth_reading",
             "title_fits", "todo_list", "copied_or_generated", "length_score", "tech_staleness_score", "dated", "expired",
             "src_chatgpt", "src_bulk", "src_agent", "log_words", "in_collection"]
    wall = fit([X[k] for k in ids], [y[k] for k in ids])
    out["weights_all"] = sorted(((n, round(v, 2)) for n, v in zip(names, wall[1:])), key=lambda t: -abs(t[1]))[:10]
    out["loo_scores"] = {k: round(v, 3) for k, v in loo.items()}
    return out


if __name__ == "__main__":
    res = {v: run(v) for v in ("jev", "openai")}
    json.dump(res, open(os.path.join(HERE, "analysis_v2.json"), "w"), indent=1)
    for v, o in res.items():
        print(f"== {v}")
        for k, val in o.items():
            if k != "loo_scores": print(f"  {k}: {val}")
