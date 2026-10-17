import { For } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import {
  createTimeBlockColorFromHue,
  extractHueFromColor,
} from "./time-block-colors";

/** Evenly readable hues; the stored value stays a plain HSL string. */
const SWATCHES = [
  { hue: 0, name: "Red" },
  { hue: 25, name: "Orange" },
  { hue: 45, name: "Amber" },
  { hue: 90, name: "Lime" },
  { hue: 140, name: "Green" },
  { hue: 175, name: "Teal" },
  { hue: 200, name: "Cyan" },
  { hue: 220, name: "Blue" },
  { hue: 250, name: "Indigo" },
  { hue: 280, name: "Purple" },
  { hue: 320, name: "Pink" },
] as const;
const HUES = SWATCHES.map((swatch) => swatch.hue);

const swatch = css({
  w: "7",
  h: "7",
  borderRadius: "full",
  cursor: "pointer",
  outline: "2px solid transparent",
  outlineOffset: "2px",
  transition: "outline-color 120ms ease, transform 120ms ease",
  _hover: { transform: "scale(1.08)" },
  _focusVisible: { outlineColor: "var(--colors-fg-muted)" },
  "&[aria-checked=true]": { outlineColor: "var(--colors-fg-default)" },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
});

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

type Props = {
  value: string;
  onChange: (color: string) => void;
  labelledBy?: string;
};

/** Radio group of block colors; arrow keys move between swatches. */
export const HueSwatches = (props: Props) => {
  const selectedHue = () => {
    const hue = extractHueFromColor(props.value);
    if (hue === null) return null;
    const closest = [...HUES].sort(
      (a, b) => hueDistance(a, hue) - hueDistance(b, hue),
    )[0];
    return hueDistance(closest, hue) <= 8 ? closest : null;
  };

  const move = (event: KeyboardEvent, index: number) => {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + HUES.length) % HUES.length;
    props.onChange(createTimeBlockColorFromHue(HUES[next]));
    const group = (event.currentTarget as HTMLElement).parentElement;
    (group?.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <HStack
      gap="2"
      flexWrap="wrap"
      role="radiogroup"
      aria-labelledby={props.labelledBy}
      py="1"
    >
      <For each={SWATCHES}>
        {({ hue, name }, index) => {
          const checked = () => selectedHue() === hue;
          return (
            <button
              type="button"
              role="radio"
              class={swatch}
              aria-checked={checked()}
              aria-label={name}
              title={name}
              tabIndex={
                checked() || (selectedHue() === null && index() === 0) ? 0 : -1
              }
              style={{
                "background-color": createTimeBlockColorFromHue(hue),
              }}
              onClick={() => props.onChange(createTimeBlockColorFromHue(hue))}
              onKeyDown={(event) => move(event, index())}
            />
          );
        }}
      </For>
    </HStack>
  );
};
