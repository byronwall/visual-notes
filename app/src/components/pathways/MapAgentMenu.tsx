import { createMemo, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import * as Popover from "~/components/ui/popover";
import { ActionButton } from "./ActionButton";
import { AutoText } from "./AutoText";
import { usePathway } from "./pathway-state";
import { help, smallButton } from "./styles";

type MapAction = "improve" | "options" | "converge" | "regenerate";

const trigger = css({
  "&[data-primary=true]": {
    bg: "blue.9",
    borderColor: "blue.9",
    color: "white",
    _hover: { bg: "blue.10" },
  },
});

/**
 * The agent's whole-map actions, in the header because they act on the
 * whole map. The panel keeps the actions for one card.
 */
export function MapAgentMenu() {
  const s = usePathway();
  const [open, setOpen] = createSignal(false);
  const nodes = () => s.record().graph.nodes;
  const feedback = createMemo(
    () =>
      nodes().filter((n) => n.feedback?.vote || n.feedback?.comment.trim())
        .length,
  );
  const mapBusy = () => s.busy() === "map";
  const run = (a: MapAction) => {
    setOpen(false);
    void s.runAgent(a, "root");
  };

  return (
    <Popover.Root
      open={open()}
      onOpenChange={(d) => setOpen(d.open)}
      positioning={{ placement: "bottom-end", strategy: "fixed", gutter: 6 }}
    >
      <Popover.Trigger
        asChild={(props) => (
          <button
            {...props()}
            class={`${smallButton} ${trigger}`}
            data-primary={String(feedback() > 0)}
          >
            {mapBusy() ? "✦ Thinking…" : "✦ Ask the agent"}
          </button>
        )}
      />
      <Portal>
        <Popover.Positioner zIndex="popover">
          <Popover.Content
            zIndex="popover"
            w="380px"
            maxW="calc(100vw - 24px)"
            p="3"
            display="flex"
            flexDirection="column"
            gap="2"
          >
            <p class={help}>
              {feedback()
                ? `${feedback()} cards have your reactions or notes. The agent reads them, with your goals.`
                : "React to cards (keys 1–5) or write your thoughts on them first, and the agent will use them."}
            </p>
            <AutoText
              key="map:steer"
              value={s.steer()}
              delay={0}
              placeholder="Steer it (optional): what to change or keep in mind"
              onSave={(v) => s.setSteer(v)}
              onSubmit={(v) => {
                s.setSteer(v);
                queueMicrotask(() => run(feedback() ? "improve" : "options"));
              }}
            />
            <ActionButton
              primary={feedback() > 0}
              label="Improve from feedback"
              shortcut={feedback() ? "⌘↵" : undefined}
              what="Drops what you rejected, replaces what you want better, and extends what you liked."
              disabled={!!s.busy() || !feedback()}
              onClick={() => run("improve")}
            />
            <ActionButton
              primary={!feedback()}
              label="What am I missing?"
              shortcut={feedback() ? undefined : "⌘↵"}
              what="Adds answers to the main question that are not on the map yet."
              disabled={!!s.busy()}
              onClick={() => run("options")}
            />
            <ActionButton
              label="Where do paths meet?"
              what="Merges duplicate cards and adds shared outcomes, so you see which choices end up in the same place."
              disabled={!!s.busy()}
              onClick={() => run("converge")}
            />
            <ActionButton
              label="Fresh map from feedback"
              what="Builds a new version as a separate map. This one stays as it is."
              disabled={!!s.busy()}
              onClick={() => run("regenerate")}
            />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
