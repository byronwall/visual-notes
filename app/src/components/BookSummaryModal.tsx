import { Show, createEffect, createSignal } from "solid-js";

export default function BookSummaryModal(props: {
  book: string | null;
  onClose: () => void;
}) {
  const [aiHtml, setAiHtml] = createSignal<string>("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  function cleanAiHtml(input: string): string {
    let s = (input || "").trim();
    const m = s.match(/<div[^>]*class=["']ai-html["'][^>]*>([\s\S]*?)<\/div>/i);
    if (m) s = m[1].trim();
    s = s.replace(/^```(?:html|md|markdown)?\s*/i, "");
    s = s.replace(/\s*```\s*$/i, "");
    s = s.replace(/```(?:html|md|markdown)?/gi, "").replace(/```/g, "");
    return s.trim();
  }

  createEffect(() => {
    const b = props.book;
    setAiHtml("");
    setError(null);
    if (!b) return;
    setLoading(true);
    fetch(`/api/book/summary?book=${encodeURIComponent(b)}&cachedOnly=1`)
      .then(async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((s) => {
        if (s && s.html) setAiHtml(cleanAiHtml(s.html));
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  });

  async function generateOrRefresh() {
    const b = props.book;
    if (!b) return;
    setLoading(true);
    setError(null);
    try {
      const isRefresh = !!aiHtml();
      const url = new URL(window.location.origin + "/api/book/summary");
      url.searchParams.set("book", b);
      if (isRefresh) url.searchParams.set("refresh", "1");
      const res = await fetch(url.toString());
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} ${t}`);
      }
      const json = await res.json();
      setAiHtml(cleanAiHtml(json.html || ""));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="modal" data-open={!!props.book} onClick={props.onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <div class="reader-head">
          <button class="cta" onClick={props.onClose}>
            Close
          </button>
          <div class="reader-controls">
            <div class="font-controls">
              <span class="small" style="align-self:center;">
                {props.book}
              </span>
              <button
                class="cta"
                disabled={loading()}
                onClick={generateOrRefresh}
              >
                {loading()
                  ? "Working…"
                  : aiHtml()
                  ? "Refresh Summary"
                  : "Create Summary"}
              </button>
            </div>
          </div>
        </div>
        <div class="reader">
          <Show when={error()}>
            <p style="color:#ffa8a8;">{error()}</p>
          </Show>
          <Show
            when={aiHtml()}
            fallback={<p>{loading() ? "Loading…" : "No summary yet."}</p>}
          >
            <div class="ai-html" innerHTML={aiHtml()} />
          </Show>
        </div>
      </div>
    </div>
  );
}
