import { For } from "solid-js";
import { css } from "styled-system/css";
import { Skeleton } from "~/components/ui/skeleton";

const rowClass = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 64px",
  columnGap: "4",
  py: "2",
});

const lineClass = css({ display: "flex", alignItems: "center" });

/** Same row box as PathNoteRow (title line + snippet line) so nothing jumps when notes arrive. */
export const PathNoteListSkeleton = () => (
  <div aria-hidden="true" class={css({ display: "flex", flexDirection: "column", gap: "2" })}>
    <div class={css({ h: "8" })} />
    <div>
      <For each={Array.from({ length: 8 })}>
        {(_, index) => (
          <div class={rowClass}>
            <div>
              <div class={lineClass} style={{ height: "22px" }}>
                <Skeleton style={{ height: "14px", width: `${40 + ((index() * 17) % 35)}%` }} />
              </div>
              <div class={lineClass} style={{ height: "20px", "margin-top": "2px" }}>
                <Skeleton style={{ height: "10px", width: `${60 + ((index() * 11) % 30)}%` }} />
              </div>
            </div>
            <div class={lineClass} style={{ height: "22px", "justify-content": "flex-end" }}>
              <Skeleton style={{ height: "10px", width: "40px" }} />
            </div>
          </div>
        )}
      </For>
    </div>
  </div>
);
