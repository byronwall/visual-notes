import { Show, createSignal } from "solid-js";
import { css } from "styled-system/css";

// A soft monogram, tinted the same way every time for one name, with the
// organization's own icon laid over it once it loads. The box never changes
// size, so an icon arriving (or failing) moves nothing.
const TINTS = ["blue", "green", "amber", "purple", "teal", "red"] as const;

const mark = css({
  position: "relative",
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  borderRadius: "l2",
  fontWeight: "semibold",
  lineHeight: "1",
  userSelect: "none",
  bg: "bg.muted",
  color: "fg.muted",
  "&[data-tint=blue]": { bg: "blue.2", color: "blue.11" },
  "&[data-tint=green]": { bg: "green.2", color: "green.11" },
  "&[data-tint=amber]": { bg: "amber.2", color: "amber.11" },
  "&[data-tint=purple]": { bg: "purple.2", color: "purple.11" },
  "&[data-tint=teal]": { bg: "teal.2", color: "teal.11" },
  "&[data-tint=red]": { bg: "red.2", color: "red.11" },
  "&[data-has-icon]": { bg: "bg.default", borderWidth: "1px", borderColor: "border" },
});
const img = css({
  position: "absolute",
  inset: "12%",
  w: "76%",
  h: "76%",
  objectFit: "contain",
});

const tintOf = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
};

/** Up to two initials: "Northwind Labs" → "NL", "Cedar & Finch" → "CF". */
export const initials = (name: string) =>
  name
    .split(/[\s&/-]+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

export function OrgMark(props: {
  org: { id: string; name: string; url?: string | null };
  /** Edge length in pixels. */
  size: number;
}) {
  // Tiny 1px "no icon" answers count as no icon.
  const [loaded, setLoaded] = createSignal(false);
  return (
    <span
      class={mark}
      data-tint={tintOf(props.org.name)}
      data-has-icon={loaded() ? "" : undefined}
      aria-hidden="true"
      style={{
        width: `${props.size}px`,
        height: `${props.size}px`,
        "font-size": `${Math.round(props.size * 0.36)}px`,
      }}
    >
      <Show when={!loaded()}>{initials(props.org.name)}</Show>
      <Show when={props.org.url}>
        <img
          class={img}
          src={`/api/org-icons/${props.org.id}`}
          alt=""
          loading="lazy"
          style={{ visibility: loaded() ? "visible" : "hidden" }}
          // A cached icon can finish before hydration attaches onLoad.
          ref={(el) =>
            queueMicrotask(() => el.complete && setLoaded(el.naturalWidth > 1))
          }
          onLoad={(e) => setLoaded(e.currentTarget.naturalWidth > 1)}
        />
      </Show>
    </span>
  );
}
