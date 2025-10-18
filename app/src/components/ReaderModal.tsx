import { Show, createEffect, createSignal, onCleanup } from "solid-js";

import { passageKey } from "~/utils/passages";

export default function ReaderModal(props: {
  refData: {
    norm: string;
    planId?: string;
    dayId?: string;
    passageId?: string;
  } | null;
  onClose: () => void;
}) {
  const [html, setHtml] = createSignal<string>("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [fontSize, setFontSize] = createSignal<number>(18);
  const [aiHtml, setAiHtml] = createSignal<string>("");
  const [aiLoading, setAiLoading] = createSignal(false);
  const [aiError, setAiError] = createSignal<string | null>(null);
  const [aiOpen, setAiOpen] = createSignal(false);

  // Normalize/sanitize AI HTML that may be wrapped in a code fence
  // and/or an outer <div class="ai-html"> container
  function cleanAiHtml(input: string): string {
    let s = (input || "").trim();
    // If the model returned an outer ai-html container, unwrap it
    const m = s.match(/<div[^>]*class=["']ai-html["'][^>]*>([\s\S]*?)<\/div>/i);
    if (m) s = m[1].trim();
    // Strip markdown code-fence wrappers like ```html ... ```
    s = s.replace(/^```(?:html|md|markdown)?\s*/i, "");
    s = s.replace(/\s*```\s*$/i, "");
    // Remove any stray fences that slipped through
    s = s.replace(/```(?:html|md|markdown)?/gi, "").replace(/```/g, "");
    return s.trim();
  }

  createEffect(() => {
    const ref = props.refData?.norm || null;
    // Reset AI summary state whenever the passage reference changes
    setAiHtml("");
    setAiError(null);
    setAiOpen(false);
    if (!ref) return;
    console.log("[reader] open", { ref });
    setLoading(true);
    setError(null);
    fetch(`/api/passage?query=${encodeURIComponent(ref)}`)
      .then(async (res) => {
        console.log("[reader] fetch /api/passage", { status: res.status });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then((h) => {
        console.log("[reader] html loaded", { length: h.length });
        setHtml(h);
      })
      .catch((e) => {
        console.error("[reader] fetch error", e);
        setError((e as Error).message);
        setHtml("");
      })
      .finally(() => setLoading(false));

    // Try to load cached AI summary for the first chapter in this ref
    setAiLoading(true);
    setAiError(null);
    fetch(`/api/passage/summary?query=${encodeURIComponent(ref)}&cachedOnly=1`)
      .then(async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((s) => {
        if (s && s.html) setAiHtml(cleanAiHtml(s.html));
      })
      .catch((e) => {
        console.warn("[reader] AI summary not cached", e);
      })
      .finally(() => setAiLoading(false));

    // Post to server to record progress when linked to a plan,
    // otherwise record an open event for ad-hoc reading
    const ids = props.refData;
    if (ids && ids.planId && ids.dayId && ids.passageId) {
      fetch("/api/progress/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: ids.planId,
          dayId: ids.dayId,
          passageId: ids.passageId,
          done: true,
        }),
      })
        .then(async (res) => {
          console.log("[reader] posted /api/progress/mark", {
            status: res.status,
          });
          if (!res.ok) {
            const t = await res.text().catch(() => "");
            throw new Error(`${res.status} ${res.statusText} ${t}`);
          }
          return res.json();
        })
        .then((json) => {
          console.log("[reader] server mark result", json);
        })
        .catch((e) => {
          console.error("[reader] server mark failed", e);
        });
    } else if (props.refData?.norm) {
      fetch("/api/progress/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ norm: props.refData.norm }),
      })
        .then(async (res) => {
          console.log("[reader] posted /api/progress/open", {
            status: res.status,
          });
          if (!res.ok) {
            const t = await res.text().catch(() => "");
            throw new Error(`${res.status} ${res.statusText} ${t}`);
          }
          return res.json();
        })
        .then((json) => {
          console.log("[reader] server open result", json);
        })
        .catch((e) => {
          console.error("[reader] server open failed", e);
        });
    } else {
      console.warn("[reader] missing passage ref, skipping server open");
    }
  });

  // Track chapters as the user reads
  let sheetEl: HTMLDivElement | undefined;
  let unsubscribeScroll: (() => void) | null = null;

  function parseChapterFromText(t: string): number | null {
    const m = t
      .replace(/\u00a0/g, " ")
      .trim()
      .match(/^(\d+)\s*:/);
    return m ? Number(m[1]) : null;
  }

  createEffect(() => {
    // Re-initialize chapter tracking whenever content or font-size changes
    const container = sheetEl;
    if (!container) return;
    const passage = props.refData?.norm || null;
    if (!passage) return;

    const seen = new Set<string>();
    let chapterNodes: HTMLElement[] = [];

    function computeChapterNodes(): void {
      const nodes = container!.querySelectorAll<HTMLElement>(
        ".esv-text .chapter-num"
      );
      chapterNodes = Array.from(nodes);
    }

    function getChapterTop(el: HTMLElement): number {
      const cRect = container!.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      return eRect.top - cRect.top + container!.scrollTop;
    }

    function recordFor(el: HTMLElement): void {
      const raw = (el.textContent || "").trim();
      if (!raw || seen.has(raw)) return;
      seen.add(raw);
      const chapter = parseChapterFromText(raw);
      console.log("[reader] chapter seen", {
        passage,
        chapterText: raw,
        chapter,
      });
    }

    function onScroll(): void {
      if (!chapterNodes.length) return;
      const y = container!.scrollTop + 4; // small buffer
      // Find the last chapter whose top is at or above the viewport top
      let candidate: HTMLElement | null = null;
      for (const node of chapterNodes) {
        const top = getChapterTop(node);
        if (top <= y) candidate = node;
        else break;
      }
      if (candidate) recordFor(candidate);
    }

    // Initialize
    queueMicrotask(() => {
      computeChapterNodes();
      console.log("[reader] chapter nodes", { count: chapterNodes.length });
      // Record the first chapter on open if present
      if (chapterNodes[0]) recordFor(chapterNodes[0]);
      // Attach scroll listener
      container.addEventListener("scroll", onScroll, { passive: true });
      unsubscribeScroll = () =>
        container.removeEventListener("scroll", onScroll);
    });

    // Recompute on next tick when content updates (html changes will trigger this effect)
    const ro = new ResizeObserver(() => {
      computeChapterNodes();
      onScroll();
    });
    ro.observe(container);

    onCleanup(() => {
      console.log("[reader] cleanup listeners");
      ro.disconnect();
      if (unsubscribeScroll) {
        unsubscribeScroll();
        unsubscribeScroll = null;
      }
    });
  });

  return (
    <div class="modal" data-open={!!props.refData} onClick={props.onClose}>
      <div
        class="sheet"
        ref={
          ((el: HTMLDivElement) => (sheetEl = el)) as unknown as HTMLDivElement
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div class="reader-head">
          <button class="cta" onClick={props.onClose}>
            Close
          </button>
          <div class="reader-controls">
            <div class="font-controls">
              <span class="small" style="align-self:center;">
                Text size
              </span>
              <button
                class="cta"
                onClick={() => setFontSize(Math.max(12, fontSize() - 2))}
                title="Smaller text"
              >
                A-
              </button>
              <button
                class="cta"
                onClick={() => setFontSize(Math.min(28, fontSize() + 2))}
                title="Larger text"
              >
                A+
              </button>
            </div>
          </div>
        </div>
        <div class="reader" style={`font-size:${fontSize()}px;`}>
          <div class="ai-summary" style="margin-bottom:12px;">
            <div class="flex items-center gap-2">
              <button
                class="cta"
                disabled={aiLoading()}
                onClick={async () => {
                  const ref = props.refData?.norm;
                  if (!ref) return;
                  setAiLoading(true);
                  setAiError(null);
                  try {
                    const isRefresh = !!aiHtml();
                    const url = new URL(
                      window.location.origin + `/api/passage/summary`
                    );
                    url.searchParams.set("query", ref);
                    if (isRefresh) url.searchParams.set("refresh", "1");
                    const res = await fetch(url.toString());
                    if (!res.ok) {
                      const t = await res.text().catch(() => "");
                      throw new Error(`${res.status} ${res.statusText} ${t}`);
                    }
                    const s = await res.json();
                    // Replace previous summary with the newly generated one
                    setAiHtml(cleanAiHtml(s.html || ""));
                    setAiOpen(true);
                  } catch (e) {
                    setAiError((e as Error).message);
                  } finally {
                    setAiLoading(false);
                  }
                }}
                title="Summarize with AI"
              >
                {aiLoading()
                  ? "Summarizing…"
                  : aiHtml()
                  ? "Refresh AI Summary"
                  : "AI Summary"}
              </button>
              <Show when={aiHtml()}>
                <button class="cta" onClick={() => setAiOpen(!aiOpen())}>
                  {aiOpen() ? "Hide details" : "Show details"}
                </button>
              </Show>
            </div>
            <Show when={aiError()}>
              <p style="color:#ffa8a8;">{aiError()}</p>
            </Show>
            <Show when={aiHtml() && aiOpen()}>
              <div class="ai-html" innerHTML={aiHtml()} />
            </Show>
          </div>
          {!loading() ? (
            !error() ? (
              <div class="esv-text" innerHTML={html()} />
            ) : (
              <p style="color:#ffa8a8;">{error()}</p>
            )
          ) : (
            <p>Loading…</p>
          )}
        </div>
        <div class="footer">
          <span class="small">
            Scripture quotations are from the ESV® Bible (The Holy Bible,
            English Standard Version®), ©2001 by Crossway, a publishing ministry
            of Good News Publishers. Used by permission. All rights reserved.
          </span>
        </div>
      </div>
    </div>
  );
}
