import { For } from "solid-js";
import { HStack } from "styled-system/jsx";

/** Live microphone level as a row of thin bars, newest on the right. */
export const LevelBars = (props: { levels: number[]; height?: string }) => (
  <HStack
    gap="0.5"
    alignItems="center"
    h={props.height ?? "5"}
    aria-hidden="true"
    flexShrink="0"
  >
    <For each={props.levels}>
      {(level) => (
        <span
          style={{
            display: "block",
            width: "2px",
            "border-radius": "1px",
            background: "var(--colors-red-9)",
            height: `${Math.max(12, level * 100)}%`,
            opacity: String(0.35 + level * 0.65),
            transition: "height 90ms linear",
          }}
        />
      )}
    </For>
  </HStack>
);
