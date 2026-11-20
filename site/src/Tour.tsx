import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { TOUR } from "./content";

const shot = (name: string) => `${import.meta.env.BASE_URL}shots/${name}.webp`;

/** Tabs across the top, the screenshot with numbered markers, and the notes beside it. */
export function Tour() {
  const [index, setIndex] = createSignal(0);
  const [hot, setHot] = createSignal<number | null>(null);
  const [zoomed, setZoomed] = createSignal(false);
  const stop = () => TOUR[index()];
  let tabs: HTMLButtonElement[] = [];

  const go = (i: number, focus = false) => {
    const next = (i + TOUR.length) % TOUR.length;
    setIndex(next);
    setHot(null);
    if (focus) tabs[next]?.focus();
  };

  // Arrow keys move through the tour when the tab list has focus.
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index() + 1, true);
    else if (e.key === "ArrowLeft") go(index() - 1, true);
    else if (e.key === "Home") go(0, true);
    else if (e.key === "End") go(TOUR.length - 1, true);
    else return;
    e.preventDefault();
  };

  // Load every screenshot once the page is idle, so switching tabs never waits.
  onMount(() => {
    const load = () => TOUR.forEach((s) => (new Image().src = shot(s.image)));
    if ("requestIdleCallback" in window) requestIdleCallback(load);
    else setTimeout(load, 800);
  });

  return (
    <section class="tour" id="tour" aria-label="Product tour">
      <div class="tour-tabs" role="tablist" aria-label="Parts of the app" onKeyDown={onTabKey}>
        <For each={TOUR}>
          {(s, i) => (
            <button
              ref={(el) => (tabs[i()] = el)}
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={index() === i()}
              aria-controls="tour-panel"
              tabIndex={index() === i() ? 0 : -1}
              onClick={() => go(i())}
            >
              {s.tab}
            </button>
          )}
        </For>
      </div>

      <div class="tour-body" id="tour-panel" role="tabpanel" aria-labelledby={`tab-${stop().id}`}>
        <div class="tour-notes">
          {/* Every stop's notes share one grid cell, so the block keeps the tallest height
              and switching tabs never moves the page below it. */}
          <div class="note-stack">
            <For each={TOUR}>
              {(s, n) => (
                <div class="note-set" classList={{ on: index() === n() }} aria-hidden={index() !== n()}>
                  <h2>{s.title}</h2>
                  <p>{s.body}</p>
                  <ol class="callouts">
                    <For each={s.callouts}>
                      {(c, i) => (
                        <li
                          classList={{ hot: index() === n() && hot() === i() }}
                          onMouseEnter={() => setHot(i())}
                          onMouseLeave={() => setHot(null)}
                        >
                          <span class="num">{i() + 1}</span>
                          {c.text}
                        </li>
                      )}
                    </For>
                  </ol>
                </div>
              )}
            </For>
          </div>
          <div class="tour-step">
            <button type="button" class="step" onClick={() => go(index() - 1)} aria-label="Previous">
              <Arrow dir="left" />
            </button>
            <span class="count">
              {index() + 1} of {TOUR.length}
            </span>
            <button type="button" class="step" onClick={() => go(index() + 1)} aria-label="Next">
              <Arrow dir="right" />
            </button>
            <span class="hint">
              or <kbd>←</kbd> <kbd>→</kbd> on the tabs
            </span>
          </div>
        </div>

        <figure class="shot">
          <button type="button" class="shot-open" onClick={() => setZoomed(true)} aria-label="Enlarge screenshot">
            <For each={TOUR}>
              {(s, i) => (
                <img
                  src={shot(s.image)}
                  alt={s.alt}
                  width="2368"
                  height="1800"
                  class="shot-img"
                  classList={{ on: index() === i() }}
                  aria-hidden={index() !== i()}
                  loading={i() === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              )}
            </For>
            <For each={stop().callouts}>
              {(c, i) => (
                <span
                  class="marker"
                  classList={{ hot: hot() === i() }}
                  style={{ left: `${c.x}%`, top: `${c.y}%` }}
                  aria-hidden="true"
                  onMouseEnter={() => setHot(i())}
                  onMouseLeave={() => setHot(null)}
                >
                  {i() + 1}
                </span>
              )}
            </For>
            <span class="expand" aria-hidden="true">
              <ExpandIcon />
            </span>
          </button>
        </figure>
      </div>

      <Show when={zoomed()}>
        <Lightbox src={shot(stop().image)} alt={stop().alt} onClose={() => setZoomed(false)} />
      </Show>
    </section>
  );
}

/** The screenshot at full size. Fits the window first; a click shows it at 1:1 for reading. */
function Lightbox(props: { src: string; alt: string; onClose: () => void }) {
  const [actual, setActual] = createSignal(false);
  let close!: HTMLButtonElement;
  const opener = document.activeElement as HTMLElement | null;
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();

  onMount(() => {
    close.focus();
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
  });
  onCleanup(() => {
    document.removeEventListener("keydown", onKey);
    document.documentElement.style.overflow = "";
    opener?.focus();
  });

  return (
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="Screenshot" onClick={props.onClose}>
      <div class="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setActual(!actual())}>
          {actual() ? "Fit to window" : "Actual size"}
        </button>
        <button type="button" ref={close} onClick={props.onClose}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
      <div class="lightbox-scroll" classList={{ actual: actual() }}>
        <img
          src={props.src}
          alt={props.alt}
          onClick={(e) => {
            e.stopPropagation();
            setActual(!actual());
          }}
        />
      </div>
    </div>
  );
}

function Arrow(props: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d={props.dir === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"}
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
