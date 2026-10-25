"""Score decision-API signals against Byron's own labels (60 notes)."""
import json, os, importlib.util
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
def mod(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
A = mod("analyze"); V2 = mod("analyze_v2")
B = json.load(open(os.path.join(HERE, "labels_byron.json")))
v2res = json.load(open(os.path.join(HERE, "analysis_v2.json")))
NOTES = A.NOTES
ids = sorted(B)
TARGETS = {
    "needs_action": lambda v: v != "keep",
    "trim": lambda v: v == "keep_but_trim",
    "drop": lambda v: v in ("archive", "delete"),
}


def auc_for(score, target):
    pos = [score[k] for k in ids if TARGETS[target](B[k]["verdict"])]
    neg = [score[k] for k in ids if not TARGETS[target](B[k]["verdict"])]
    return round(A.auc(pos, neg), 3)


out = {"counts": dict(Counter(B[k]["verdict"] for k in ids)),
       "base_rates": {t: round(sum(f(B[k]["verdict"]) for k in ids) / len(ids), 3) for t, f in TARGETS.items()}}
for v in ("jev", "openai"):
    r1, r2 = A.load(f"{v}__note"), A.load(f"{v}__note_v2")
    a = lambda k, q: (r1[k]["answers"].get(q) or r2[k]["answers"].get(q))
    sig = {
        "claude_trained_drop_score": {k: v2res[v]["loo_scores"][k] for k in ids},
        "copied_or_generated": {k: a(k, "copied_or_generated")["p"] for k in ids},
        "rederivable": {k: a(k, "rederivable")["p"] for k in ids},
        "not_author_specific": {k: 1 - a(k, "author_specific")["p"] for k in ids},
        "not_worth_reading": {k: 1 - a(k, "worth_reading")["p"] for k in ids},
        "length_score": {k: a(k, "length_fit")["score"] for k in ids},
        "long_filler_prob": {k: a(k, "length_fit")["probs"].get("long_filler", 0) for k in ids},
        "src_chatgpt": {k: float(NOTES[k]["facts"]["source"] == "chatgpt_transcript") for k in ids},
        "holistic_not_keep": {k: 1 - a(k, "verdict")["probs"].get("keep", 0) for k in ids},
        "holistic_trim": {k: a(k, "verdict")["probs"].get("keep_but_trim", 0) for k in ids},
        "holistic_drop": {k: a(k, "verdict")["probs"].get("delete", 0) + a(k, "verdict")["probs"].get("archive", 0) for k in ids},
        "is_todo": {k: a(k, "is_todo")["p"] for k in ids},
        "empty_or_stub": {k: a(k, "empty_or_stub")["p"] for k in ids},
    }
    out[v] = {name: {t: auc_for(s, t) for t in TARGETS} for name, s in sig.items()}
    # weights refit on Byron's labels, leave-one-out, strong L2 (60 notes)
    X = {k: V2.feats(k, r1[k]["answers"], r2[k]["answers"]) for k in ids}
    for t in ("needs_action", "trim"):
        y = {k: float(TARGETS[t](B[k]["verdict"])) for k in ids}
        loo = {}
        for k in ids:
            tr = [j for j in ids if j != k]
            w = V2.fit([X[j] for j in tr], [y[j] for j in tr], l2=0.2, steps=800)
            loo[k] = V2.pred(w, X[k])
        out[v][f"byron_fit_loo_{t}"] = {"auc": auc_for(loo, t),
                                        "acc": round(sum((loo[k] >= .5) == y[k] for k in ids) / len(ids), 3)}
    # make_task / todo canaries
    out[v]["make_task_ids_is_todo"] = {NOTES[k]["title"]: round(a(k, "is_todo")["p"], 2) for k in ids if B[k]["verdict"] == "make_task"}
# Claude reference itself as a predictor of Byron
C = json.load(open(os.path.join(HERE, "labels_claude.json")))
out["claude_ref_exact"] = round(sum(C[k]["verdict"] == B[k]["verdict"] for k in ids) / len(ids), 3)
out["claude_ref_needs_action_acc"] = round(sum((C[k]["verdict"] != "keep") == (B[k]["verdict"] != "keep") for k in ids) / len(ids), 3)
json.dump(out, open(os.path.join(HERE, "analysis_byron.json"), "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k not in ("jev", "openai")}, indent=1))
for v in ("jev", "openai"):
    print(f"== {v}   (AUC vs Byron: needs_action / trim / drop)")
    for name, s in out[v].items():
        print(f"  {name:28} {s}")
