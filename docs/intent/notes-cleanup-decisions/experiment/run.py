"""Run the note-cleanup decision experiment against Jev and OpenAI Decisions (+ an LLM baseline).

usage: python3 -I run.py <task> <vendor> [--limit N] [--ids a,b]
  task:   note | note_rev | sections | pairs | llm
  vendor: jev | openai   (llm task is openai-only)
Results are cached per (task, vendor, key) in results/*.jsonl, so reruns only fill gaps.
Keys come from the environment (TYPESAFE_API_KEY, OPENAI_API_KEY); they are never printed.
"""
import json, os, sys, time, threading, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("q", os.path.join(HERE, "questions.py"))
Q = importlib.util.module_from_spec(spec); spec.loader.exec_module(Q)

JEV_MODEL = "jev-1.14.0"
OPENAI_MODEL = "gpt-6-luna"
PRICE = {"jev": 0.042, "openai": 0.10}  # USD per 1M input tokens
LLM_PRICE_IN, LLM_PRICE_OUT = 0.10, 0.50
BUDGET_USD = {"jev": 1.50, "openai": 3.00}
WORKERS = 6

DATA = json.load(open(os.path.join(HERE, "states.json")))
OWNER = DATA["owner"]
NOTES = DATA["notes"]
BY_ID = {n["id"]: n for n in NOTES}
BY_TITLE = {n["title"]: n for n in NOTES}
RES = os.path.join(HERE, "results"); os.makedirs(RES, exist_ok=True)
lock = threading.Lock()


def post(url, key, body, retries=4):
    data = json.dumps(body).encode()
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read()), time.time() - t0
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:600]
            if e.code in (429, 500, 502, 503, 529) and attempt < retries:
                time.sleep(2 ** attempt + 1); continue
            raise RuntimeError(f"HTTP {e.code}: {msg}")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                time.sleep(2 ** attempt + 1); continue
            raise


# ---- adapters ---------------------------------------------------------------

def jev_questions(qs, reverse=False):
    out = {}
    for q in qs:
        if q["type"] == "noul":
            out[q["id"]] = {"type": "noul", "instructions": q["instructions"]}
        elif q["type"] == "choice":
            opts = list(reversed(q["options"])) if reverse else q["options"]
            out[q["id"]] = {"type": "choice", "instructions": q["instructions"], "criteria": dict(opts)}
        else:
            out[q["id"]] = {"type": "score", "instructions": q["instructions"],
                            "criteria": [desc for _, desc in q["levels"]]}
    return out


def openai_questions(qs, reverse=False):
    out = []
    for q in qs:
        if q["type"] == "noul":
            out.append({"name": q["id"], "type": "predicate", "instructions": q["instructions"]})
        elif q["type"] == "choice":
            opts = list(reversed(q["options"])) if reverse else q["options"]
            out.append({"name": q["id"], "type": "choice", "instructions": q["instructions"],
                        "choices": [{"value": k, "description": d} for k, d in opts]})
        else:
            out.append({"name": q["id"], "type": "score", "instructions": q["instructions"],
                        "levels": [{"label": k, "description": d} for k, d in q["levels"]]})
    return out


def normalize(vendor, qs, resp):
    """-> {qid: {"p": prob for noul, "choice"/"probs" for choice, "score"/"probs" for score}}"""
    out = {}
    if vendor == "jev":
        for q in qs:
            a = resp["answers"][q["id"]]
            if q["type"] == "noul":
                out[q["id"]] = {"p": a["noul"]}
            elif q["type"] == "choice":
                out[q["id"]] = {"choice": a["choice"], "probs": a["probabilities"], "conf": a.get("confidence")}
            else:
                labels = [k for k, _ in q["levels"]]
                out[q["id"]] = {"score": a["score"], "conf": a.get("confidence"),
                                "probs": {labels[int(k)]: v for k, v in a["probabilities"].items()}}
    else:
        ans = {a["name"]: a for a in resp["answers"]}
        for q in qs:
            a = ans[q["id"]]
            if q["type"] == "noul":
                out[q["id"]] = {"p": a["probability"]}
            elif q["type"] == "choice":
                out[q["id"]] = {"choice": a["choice"], "conf": a.get("confidence"),
                                "probs": {p["value"]: p["probability"] for p in a["probabilities"]}}
            else:
                out[q["id"]] = {"score": a["score"], "conf": a.get("confidence"),
                                "probs": {p["label"]: p["probability"] for p in a["probabilities"]}}
    return out


def decide(vendor, state, qs, reverse=False):
    if vendor == "jev":
        body = {"model": JEV_MODEL, "state": state, "questions": jev_questions(qs, reverse)}
        resp, dt = post("https://api.typesafe.ai/v1/systemone", os.environ["TYPESAFE_API_KEY"], body)
        tokens = resp["usage"]["input_tokens"]
    else:
        owner = state.pop("owner", None)
        msgs = []
        if owner:
            msgs.append({"role": "developer", "content": [{"type": "input_text", "text":
                         "The JSON below is about notes kept by `owner`. owner = " + json.dumps(owner)}]})
        msgs.append({"role": "user", "content": [{"type": "input_json", "data": state}]})
        body = {"model": OPENAI_MODEL, "input": msgs, "questions": openai_questions(qs, reverse)}
        resp, dt = post("https://api.openai.com/v1/decisions", os.environ["OPENAI_API_KEY"], body)
        tokens = resp["usage"]["input_tokens"]
    return {"model": resp.get("model"), "answers": normalize(vendor, qs, resp), "tokens": tokens, "latency": dt}


# ---- LLM baseline (same questions, generative JSON) ---------------------------

def llm(state, qs):
    props, lines = {}, []
    for q in qs:
        if q["type"] == "noul":
            props[q["id"]] = {"type": "boolean"}; lines.append(f'- {q["id"]} (true/false): {q["instructions"]}')
        elif q["type"] == "choice":
            props[q["id"]] = {"type": "string", "enum": [k for k, _ in q["options"]]}
            lines.append(f'- {q["id"]}: {q["instructions"]} Options: ' + "; ".join(f"{k} = {d}" for k, d in q["options"]))
        else:
            props[q["id"]] = {"type": "string", "enum": [k for k, _ in q["levels"]]}
            lines.append(f'- {q["id"]}: {q["instructions"]} Levels: ' + "; ".join(f"{k} = {d}" for k, d in q["levels"]))
    schema = {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}
    owner = state.pop("owner")
    body = {"model": OPENAI_MODEL, "input": [
        {"role": "developer", "content": "Answer each question about the note in the user's JSON. `owner` = "
         + json.dumps(owner) + "\nQuestions:\n" + "\n".join(lines)},
        {"role": "user", "content": json.dumps(state)}],
        "text": {"format": {"type": "json_schema", "name": "answers", "schema": schema, "strict": True}}}
    resp, dt = post("https://api.openai.com/v1/responses", os.environ["OPENAI_API_KEY"], body)
    txt = next(c["text"] for o in resp["output"] if o.get("type") == "message" for c in o["content"]
               if c.get("type") == "output_text")
    u = resp["usage"]
    cost = u["input_tokens"] * LLM_PRICE_IN / 1e6 + u["output_tokens"] * LLM_PRICE_OUT / 1e6
    return {"model": resp.get("model"), "answers": json.loads(txt), "tokens": u["input_tokens"],
            "out_tokens": u["output_tokens"], "cost": cost, "latency": dt}


# ---- tasks ----------------------------------------------------------------------

def note_state(n):
    return {"owner": OWNER, "facts": n["facts"], "note": {"title": n["title"], "body": n["body"]}}


def jobs(task):
    if task in ("note", "note_rep", "llm"):
        return [(n["id"], note_state(n), Q.NOTE_QUESTIONS, False) for n in NOTES]
    if task == "note_v2":
        return [(n["id"], note_state(n), Q.NOTE_QUESTIONS_V2, False) for n in NOTES]
    if task == "note_rev":
        qs = [q for q in Q.NOTE_QUESTIONS if q["type"] == "choice"]
        return [(n["id"], note_state(n), qs, True) for n in NOTES]
    if task == "sections":
        return [(n["id"], {"note": {"title": n["title"], "sections": n["sections"]}},
                 Q.SECTION_QUESTIONS(len(n["sections"])), False) for n in NOTES if n["sections"]]
    if task == "pairs":
        out = []
        for ta, tb, _ in Q.PAIRS:
            a, b = BY_TITLE[ta], BY_TITLE[tb]
            side = lambda n: {"title": n["title"], "path": n["path"], "created": n["facts"]["created"],
                              "body": n["body"][:8000]}
            out.append((f'{a["id"]}|{b["id"]}', {"owner": OWNER, "a": side(a), "b": side(b)}, Q.PAIR_QUESTIONS, False))
        return out
    raise SystemExit(f"unknown task {task}")


def main():
    task, vendor = sys.argv[1], sys.argv[2]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    only = set(sys.argv[sys.argv.index("--ids") + 1].split(",")) if "--ids" in sys.argv else None
    path = os.path.join(RES, f"{vendor}__{task}.jsonl")
    done = {}
    if os.path.exists(path):
        for line in open(path):
            r = json.loads(line); done[r["key"]] = r
    spent = {"usd": sum(r.get("cost", 0) for r in done.values())}
    todo = [j for j in jobs(task) if j[0] not in done and (not only or j[0] in only)]
    if limit: todo = todo[:limit]
    print(f"[exp] {task}/{vendor}: {len(done)} cached, {len(todo)} to run, spent so far ${spent['usd']:.4f}")
    errors = []

    def one(job):
        key, state, qs, rev = job
        cap = BUDGET_USD["openai" if task == "llm" else vendor]
        if spent["usd"] > cap:
            return
        try:
            r = llm(json.loads(json.dumps(state)), qs) if task == "llm" else \
                decide(vendor, json.loads(json.dumps(state)), qs, rev)
        except Exception as e:  # noqa: BLE001
            errors.append((key, str(e)[:300])); return
        if "cost" not in r:
            r["cost"] = r["tokens"] * PRICE[vendor] / 1e6
        r["key"] = key; r["version"] = Q.QUESTION_SET_VERSION
        with lock:
            spent["usd"] += r["cost"]
            with open(path, "a") as f:
                f.write(json.dumps(r) + "\n")

    with ThreadPoolExecutor(WORKERS) as ex:
        list(ex.map(one, todo))
    n = sum(1 for _ in open(path)) if os.path.exists(path) else 0
    print(f"[exp] {task}/{vendor}: now {n} results, spent ${spent['usd']:.4f}, errors {len(errors)}")
    for k, e in errors[:5]:
        print("   ", k, e)


if __name__ == "__main__":
    main()
