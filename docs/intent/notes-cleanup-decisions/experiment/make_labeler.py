"""Write a blind, self-contained labeling page for Byron (no model answers shown)."""
import json, os, random, html, sys

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "states.json")))
ref = json.load(open(os.path.join(HERE, "labels_claude.json")))
v2 = json.load(open(os.path.join(HERE, "analysis_v2.json")))
DROP = {"delete", "archive"}
notes = {n["id"]: n for n in data["notes"]}
loo = v2["openai"]["loo_scores"]
hold = [k for k, n in notes.items() if n["split"] == "holdout"]
dev = sorted((k for k, n in notes.items() if n["split"] == "dev"),
             key=lambda k: -abs(loo[k] - (ref[k]["verdict"] in DROP)))[:19]
pick = hold + dev
random.Random(7).shuffle(pick)
items = [{"id": k, "title": notes[k]["title"], "path": notes[k]["path"] or "(unfiled)",
          "created": notes[k]["facts"]["created"], "source": notes[k]["facts"]["source"],
          "words": notes[k]["facts"]["words"], "body": notes[k]["body"][:2500],
          "url": f"https://notes.apps.byroni.us/docs/{k}"} for k in pick]

page = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Note Cleanup Labels</title><style>
:root{--bg:#f7f7f5;--panel:#fff;--ink:#1d1d1b;--muted:#6b6b66;--line:#e2e1dc;--accent:#2f5bd3;--sel:#e8eefc}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--panel:#1f1f1d;--ink:#ecebe6;--muted:#9a9993;--line:#33322f;--accent:#7c9cf0;--sel:#24304d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:2}
header h1{font-size:15px;margin:0}header .sp{flex:1}button{font:inherit;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:6px;padding:5px 10px;cursor:pointer}
button:hover{border-color:var(--accent)}main{max-width:900px;margin:0 auto;padding:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:12px}
.card.done{opacity:.72}.meta{color:var(--muted);font-size:12px;margin:2px 0 8px}.meta a{color:var(--accent)}
.t{font-weight:600;font-size:15px}pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px;max-height:220px;overflow:auto;font:12px/1.4 ui-monospace,monospace;margin:0 0 10px}
.opts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.opts button.on{background:var(--sel);border-color:var(--accent)}
.opts input{flex:1;min-width:160px;font:inherit;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}
.help{color:var(--muted);font-size:12px}
</style></head><body><header><h1>Note cleanup labels</h1><span class="help" id="count"></span><span class="sp"></span>
<span class="help">Keys on focused card: 1 keep · 2 trim · 3 archive · 4 delete · 5 task</span>
<button id="dl">Download labels.json</button></header><main id="list"></main>
<script>
const ITEMS=__ITEMS__;const OPTS=[["keep","Keep"],["keep_but_trim","Keep, trim"],["archive","Archive"],["delete","Delete"],["make_task","Make task"]];
const KEY="note-cleanup-labels-v1";let L={};try{L=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(L))}catch(e){};count()};
const count=()=>{document.getElementById("count").textContent=Object.values(L).filter(x=>x.verdict).length+" / "+ITEMS.length+" labeled"};
const list=document.getElementById("list");
ITEMS.forEach((it,i)=>{const c=document.createElement("div");c.className="card";c.tabIndex=0;
c.innerHTML=`<div class="t">${i+1}. ${esc(it.title)}</div><div class="meta">${esc(it.path)} · ${it.created} · ${it.source} · ${it.words} words · <a href="${it.url}" target="_blank" rel="noopener">open</a></div><pre>${esc(it.body)}</pre><div class="opts"></div>`;
const o=c.querySelector(".opts");OPTS.forEach(([v,lab])=>{const b=document.createElement("button");b.textContent=lab;b.dataset.v=v;b.onclick=()=>pick(it.id,v,c);o.appendChild(b)});
const r=document.createElement("input");r.placeholder="one-word reason (optional)";r.value=(L[it.id]||{}).reason||"";r.oninput=()=>{L[it.id]={...(L[it.id]||{}),reason:r.value};save()};o.appendChild(r);
c.addEventListener("keydown",e=>{if(e.target.tagName==="INPUT")return;const n=+e.key;if(n>=1&&n<=5){pick(it.id,OPTS[n-1][0],c);const nx=c.nextElementSibling;if(nx)nx.focus()}});
list.appendChild(c);paint(it.id,c)});
function pick(id,v,c){L[id]={...(L[id]||{}),verdict:v};save();paint(id,c)}
function paint(id,c){const v=(L[id]||{}).verdict;c.classList.toggle("done",!!v);c.querySelectorAll(".opts button").forEach(b=>b.classList.toggle("on",b.dataset.v===v))}
function esc(s){return String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]))}
document.getElementById("dl").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(L,null,1)],{type:"application/json"}));a.download="labels.json";a.click()};
count();
</script></body></html>"""
out = sys.argv[1]
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "w").write(page.replace("__ITEMS__", json.dumps(items).replace("</", "<\\/")))
print(len(items), "notes ->", out)
