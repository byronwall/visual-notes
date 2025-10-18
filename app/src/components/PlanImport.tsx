import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { sampleCsv } from "./sampleCsv";
import { apiFetch } from "~/utils/base-url";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "",
    row: string[] = [],
    inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i],
      n = text[i + 1];
    if (c === '"' && inQ && n === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && (c === "," || c === "\t")) {
      row.push(cur.trim());
      cur = "";
      continue;
    }
    if (!inQ && (c === "\n" || c === "\r")) {
      if (cur.length || row.length) {
        row.push(cur.trim());
        rows.push(row);
        row = [];
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x));
}

export default function PlanImport() {
  const navigate = useNavigate();
  const [text, setText] = createSignal("");
  const [title, setTitle] = createSignal("My Reading Plan");
  const [isGlobal, setIsGlobal] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const onImport = async () => {
    setLoading(true);
    try {
      const rows = parseCSV(text());
      if (!rows.length) throw new Error("No rows detected");
      // detect header and date index like client
      const header = rows[0].map((h) => h.toLowerCase());
      let headerHasDate = false;
      for (let i = 0; i < header.length; i++) {
        if (header[i] && header[i].toLowerCase().indexOf("date") !== -1) {
          headerHasDate = true;
          break;
        }
      }
      let dateIdx = 0;
      if (headerHasDate) {
        for (let i = 0; i < header.length; i++) {
          if (header[i] && header[i].toLowerCase().indexOf("date") !== -1) {
            dateIdx = i;
            break;
          }
        }
      }
      const res = await apiFetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title(),
          isGlobal: isGlobal(),
          rows,
          headerHasDate,
          dateIdx,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any));
        throw new Error(j?.error || `Plan create failed: ${res.status}`);
      }
      const created = (await res.json()) as { id: string };
      navigate(`/plans/${created.id}`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onFile = (f: File) => {
    f.text().then((v) => setText(v));
  };

  const loadSample = () => {
    setText(sampleCsv);
  };

  return (
    <div class="card">
      <h3>Import Plan (CSV/TSV)</h3>
      <div class="tools">
        <input
          id="file"
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) onFile(f);
          }}
        />
        <label class="cta" for="file">
          Choose File
        </label>
        <button class="cta" onClick={loadSample} disabled={loading()}>
          Load Sample
        </button>
      </div>
      <p class="small">
        Format: first column is the date (or a header containing{" "}
        <code>Date</code>), and remaining columns contain passages separated by
        comma/semicolon/pipe (e.g., <code>Amos 5, Acts 10; Psalm 90-91</code>).
      </p>
      <input
        class="cta"
        style="width:100%; margin:6px 0;"
        value={title()}
        onInput={(e) => setTitle(e.currentTarget.value)}
        placeholder="Plan title"
      />
      <label class="small" style="display:flex; gap:8px; align-items:center;">
        <input
          type="checkbox"
          checked={isGlobal()}
          onInput={(e) => setIsGlobal((e.target as HTMLInputElement).checked)}
        />
        Global plan (visible to everyone)
      </label>
      <textarea
        style="width:100%; height:160px;"
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="cta" onClick={onImport} disabled={loading()}>
          {loading() ? "Importing..." : "Import"}
        </button>
      </div>
    </div>
  );
}
