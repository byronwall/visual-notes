import { LayersIcon } from "lucide-solid";
import { css } from "styled-system/css";

/** A topic with no cards yet: say how cards arrive, since nothing here adds them by hand. */
export const EmptyTopic = (props: { title: string }) => (
  <div
    class={css({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "2",
      h: "full",
      minH: "60",
      px: "6",
      textAlign: "center",
    })}
    data-testid="research-empty"
  >
    <LayersIcon size={28} class={css({ color: "fg.subtle" })} />
    <h2 class={css({ fontSize: "md", fontWeight: "semibold" })}>
      No cards yet
    </h2>
    <p class={css({ maxW: "26rem", fontSize: "sm", color: "fg.muted" })}>
      Ask an agent with the Visual Notes connector to research “{props.title}”.
      Its questions, findings, and sources land here as cards, and each batch
      can be undone.
    </p>
  </div>
);
