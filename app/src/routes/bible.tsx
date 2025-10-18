import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onMount,
} from "solid-js";
import ReaderModal from "~/components/ReaderModal";
import BookSummaryModal from "~/components/BookSummaryModal";
import { NT_BOOKS, OT_BOOKS, chapterRef, type BibleBook } from "~/utils/bible";

export default function BibleOverview() {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  const [openRef, setOpenRef] = createSignal<{ norm: string } | null>(null);
  const [openBook, setOpenBook] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal("");
  const [sortMode, setSortMode] = createSignal<"canonical" | "alpha">(
    "canonical"
  );
  type HistoryRow = {
    dayId: string | null;
    passageId: string;
    planId: string | null;
    updatedAt: string;
    day: { label: string; position: number; planId: string } | null;
    passage: { ref: string; norm: string };
  };

  async function fetchHistory() {
    const res = await fetch("/api/progress/history");
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as HistoryRow[];
  }

  const [history] = createResource(mounted, fetchHistory);

  const allBooks = createMemo(() => ({ ot: OT_BOOKS, nt: NT_BOOKS }));

  function matchesFuzzy(name: string, q: string): boolean {
    if (!q) return true;
    let i = 0;
    let j = 0;
    const hay = name.toLowerCase();
    const needle = q.toLowerCase();
    while (i < hay.length && j < needle.length) {
      if (hay[i] === needle[j]) j++;
      i++;
    }
    return j === needle.length;
  }

  const filteredBooks = createMemo(() => {
    const q = query().trim();
    const filter = (books: BibleBook[]) =>
      books.filter((b) => matchesFuzzy(b.name, q));
    return { ot: filter(allBooks().ot), nt: filter(allBooks().nt) };
  });

  const alphabeticalBooks = createMemo(() => {
    const combined = [...filteredBooks().ot, ...filteredBooks().nt];
    function normalize(n: string) {
      const m = n.match(/^([1-3])\s+(.*)$/);
      const num = m ? Number(m[1]) : 0;
      const base = (m ? m[2] : n).toLowerCase();
      return { base, num };
    }
    return combined.sort((a, b) => {
      const na = normalize(a.name);
      const nb = normalize(b.name);
      const cmp = na.base.localeCompare(nb.base);
      if (cmp !== 0) return cmp;
      if (na.num !== nb.num) return na.num - nb.num;
      return a.name.localeCompare(b.name);
    });
  });

  function expandRefToChapterKeys(ref: string): string[] {
    // Normalize dashes and trim
    const normalized = ref.replace(/\u2013|\u2014/g, "-");
    // Split into book and numeric part (chapter/verses) by first occurrence of space+digit
    const m = normalized.match(/^(.*?)(\s\d.*)$/);
    if (!m) return [];
    const book = m[1].trim();
    const rest = m[2].trim();

    const keys: string[] = [];

    function addKey(ch: number) {
      if (!Number.isFinite(ch)) return;
      keys.push(`${book} ${ch}`.toLowerCase());
    }

    // Range detection (hyphen)
    if (rest.includes("-")) {
      const idx = rest.indexOf("-");
      const left = rest.slice(0, idx).trim();
      const right = rest.slice(idx + 1).trim();

      const leftChapterMatch = left.match(/^(\d+)/);
      const rightChapterMatch = right.match(/^(\d+)/);
      const leftChapter = leftChapterMatch ? Number(leftChapterMatch[1]) : NaN;
      let endChapter = rightChapterMatch ? Number(rightChapterMatch[1]) : NaN;

      const leftHasColon = left.includes(":");
      const rightHasColon = right.includes(":");

      // If it's a verse range within the same chapter like "3:16-18",
      // treat it as the single chapter from the left side
      if (leftHasColon && !rightHasColon && !right.includes(" ")) {
        endChapter = leftChapter;
      }

      const start = Number.isFinite(leftChapter) ? leftChapter : NaN;
      const end = Number.isFinite(endChapter) ? endChapter : leftChapter;
      if (Number.isFinite(start) && Number.isFinite(end)) {
        const lo = Math.min(start, end);
        const hi = Math.max(start, end);
        for (let ch = lo; ch <= hi; ch++) addKey(ch);
      }
      return keys;
    }

    // Single chapter (possibly with verses like "6:12-18")
    const singleMatch = rest.match(/^(\d+)/);
    if (singleMatch) addKey(Number(singleMatch[1]));
    return keys;
  }

  const doneSet = createMemo(() => {
    const rows = history() || [];
    const s = new Set<string>();
    for (const r of rows) {
      // Expand ranges like "Psalms 52–55" to individual chapters
      const keys = expandRefToChapterKeys(r.passage.ref);
      if (keys.length) {
        for (const k of keys) s.add(k);
      }
    }
    return s;
  });

  createEffect(() => {
    console.log("[bible] doneSet", { doneSet: doneSet() });
  });

  function shadeFor(ref: string): string {
    // console.log("[bible] shadeFor", { ref });
    const key = ref.toLowerCase();
    return doneSet().has(key) ? "#34d399" : "#bfdbfe"; // green if done else light blue
  }

  function textColorFor(bg: string): string {
    // Compute luminance and pick black/white for contrast
    const hex = bg.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    // sRGB to linear
    const toLin = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const rl = toLin(r);
    const gl = toLin(g);
    const bl = toLin(b);
    const L = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
    return L > 0.5 ? "#000000" : "#ffffff";
  }

  function onOpenChapter(book: BibleBook, chapter: number) {
    // Open chapter; local marking removed
    const ref = chapterRef(book, chapter);
    setOpenRef({ norm: ref });
  }

  function onOpenBookSummary(book: BibleBook) {
    setOpenBook(book.name);
  }

  return (
    <div class="container mx-auto px-4 py-4">
      <div class="mb-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="Search books…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          class="w-40 sm:w-56 rounded border border-gray-300 px-2 py-1  focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Search books"
        />
        <div
          class="ml-auto flex items-center gap-1"
          role="tablist"
          aria-label="Sort"
        >
          <button
            class={`px-2 py-1 rounded border text-sm ${
              sortMode() === "canonical"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300"
            }`}
            onClick={() => setSortMode("canonical")}
            aria-selected={sortMode() === "canonical"}
          >
            Canonical
          </button>
          <button
            class={`px-2 py-1 rounded border text-sm ${
              sortMode() === "alpha"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300"
            }`}
            onClick={() => setSortMode("alpha")}
            aria-selected={sortMode() === "alpha"}
          >
            A–Z
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-6">
        <Show
          when={!history.loading}
          fallback={<div class="card p-3">Loading history…</div>}
        >
          <Show
            when={sortMode() === "canonical"}
            fallback={
              <Section
                title="Alphabetical"
                books={alphabeticalBooks()}
                onOpen={onOpenChapter}
                onOpenSummary={onOpenBookSummary}
                shadeFor={shadeFor}
                textColorFor={textColorFor}
              />
            }
          >
            <Section
              title="Old Testament"
              books={filteredBooks().ot}
              onOpen={onOpenChapter}
              onOpenSummary={onOpenBookSummary}
              shadeFor={shadeFor}
              textColorFor={textColorFor}
            />
            <Section
              title="New Testament"
              books={filteredBooks().nt}
              onOpen={onOpenChapter}
              onOpenSummary={onOpenBookSummary}
              shadeFor={shadeFor}
              textColorFor={textColorFor}
            />
          </Show>
        </Show>
      </div>

      <ReaderModal refData={openRef()} onClose={() => setOpenRef(null)} />
      <BookSummaryModal book={openBook()} onClose={() => setOpenBook(null)} />
    </div>
  );
}

function Section(props: {
  title: string;
  books: BibleBook[];
  onOpen: (book: BibleBook, chapter: number) => void;
  onOpenSummary: (book: BibleBook) => void;
  shadeFor: (ref: string) => string;
  textColorFor: (bg: string) => string;
}) {
  return (
    <section class="card p-4 ">
      <h2 class="text-xl font-semibold mb-3">{props.title}</h2>
      <ul class="flex flex-col gap-1">
        <For each={props.books}>
          {(book) => (
            <div class="flex flex-wrap gap-1 mt-2 border-b pb-2">
              <div class="text-sm font-medium leading-6 shrink-0 w-[120px] pr-1 flex items-center gap-1">
                <span class="truncate">{book.name}</span>
                <button
                  class="rounded border text-[10px] px-1 ml-auto"
                  title={`AI summary for ${book.name}`}
                  onClick={() => props.onOpenSummary(book)}
                >
                  AI
                </button>
              </div>
              <For
                each={Array.from({ length: book.chapters }, (_, i) => i + 1)}
              >
                {(ch) => {
                  const bg = props.shadeFor(`${book.name} ${ch}`);
                  const fg = props.textColorFor(bg);
                  return (
                    <button
                      class="rounded text-[10px] leading-4 w-6 h-6 flex items-center justify-center font-semibold"
                      style={`background:${bg}; color:${fg};`}
                      title={`${book.name} ${ch}`}
                      onClick={() => props.onOpen(book, ch)}
                    >
                      {ch}
                    </button>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </ul>
    </section>
  );
}
