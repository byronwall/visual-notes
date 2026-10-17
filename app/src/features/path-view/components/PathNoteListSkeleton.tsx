import { For } from "solid-js";
import { css } from "styled-system/css";
import { Skeleton } from "~/components/ui/skeleton";

/** Same row rhythm as PathNoteRow so the list does not jump when notes arrive. */
export const PathNoteListSkeleton = () => (
  <div aria-hidden="true" class={css({ display: "flex", flexDirection: "column", gap: "2" })}>
    <div class={css({ h: "8" })} />
    <For each={Array.from({ length: 8 })}>
      {(_, index) => (
        <div class={css({ py: "2", display: "flex", flexDirection: "column", gap: "1.5" })}>
          <Skeleton style={{ height: "16px", width: `${40 + ((index() * 17) % 35)}%` }} />
          <Skeleton style={{ height: "12px", width: `${60 + ((index() * 11) % 30)}%` }} />
        </div>
      )}
    </For>
  </div>
);
