import { For, Show, type VoidComponent } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { css } from "styled-system/css";
import { Grid, HStack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";
import { weekday } from "~/lib/events/time";
import { FieldRow } from "./EventDetailsForm";
import type { RepeatDraft, RepeatMode } from "./repeat-draft";

const NTH = ["1st", "2nd", "3rd", "4th", "last"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const dayToggle = css({
  w: "7",
  h: "7",
  borderRadius: "full",
  borderWidth: "1px",
  borderColor: "border",
  textStyle: "xs",
  fontWeight: "medium",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { bg: "gray.a3" },
  "&[aria-pressed=true], &[aria-pressed=true]:hover": {
    bg: "colorPalette.solid.bg",
    borderColor: "colorPalette.solid.bg",
    color: "colorPalette.solid.fg",
  },
  _focusVisible: { outline: "2px solid", outlineColor: "border.focus" },
});

const modeItems = (date: string) => {
  const day = date ? Number(date.slice(8, 10)) : null;
  const dow = date ? DAY_NAMES[weekday(date)] : "weekday";
  const nth = day ? NTH[Math.min(5, Math.ceil(day / 7)) - 1] : "nth";
  return [
    { value: "weekly", label: "Weekly" },
    {
      value: "monthly-day",
      label: day ? `Monthly on day ${day}` : "Monthly on the same day",
    },
    { value: "monthly-nth", label: `Monthly on the ${nth} ${dow}` },
  ];
};

/** Rule inputs: frequency, interval, weekdays, and how the run ends. */
export const RepeatRuleFields: VoidComponent<{
  draft: RepeatDraft;
  setDraft: SetStoreFunction<RepeatDraft>;
}> = (props) => {
  const d = () => props.draft;
  const toggleDay = (dow: number) =>
    props.setDraft("weekdays", (days) =>
      days.includes(dow) ? days.filter((x) => x !== dow) : [...days, dow],
    );

  return (
    <>
      <FieldRow label="Repeats">
        <SimpleSelect
          items={modeItems(d().date)}
          value={d().mode}
          onChange={(v) => v && props.setDraft("mode", v as RepeatMode)}
          size="xs"
          sameWidth={false}
          skipPortal={false}
          positioning={{ placement: "bottom-start", strategy: "fixed" }}
        />
      </FieldRow>
      <FieldRow label="Every">
        <HStack gap="1.5">
          <Input
            size="xs"
            type="number"
            min="1"
            max="12"
            w="16"
            aria-label="Interval"
            value={String(d().interval)}
            onInput={(e) =>
              props.setDraft("interval", Number(e.currentTarget.value) || 1)
            }
          />
          <Text textStyle="xs" color="fg.muted">
            {d().mode === "weekly" ? "week(s)" : "month(s)"}
          </Text>
        </HStack>
      </FieldRow>
      <Show when={d().mode === "weekly"}>
        <FieldRow label="On">
          <HStack
            gap="1"
            role="group"
            aria-label="Weekdays"
            colorPalette="blue"
          >
            <For each={DAY_LETTERS}>
              {(letter, i) => (
                <button
                  type="button"
                  class={dayToggle}
                  aria-label={DAY_NAMES[i()]}
                  aria-pressed={d().weekdays.includes(i())}
                  onClick={() => toggleDay(i())}
                >
                  {letter}
                </button>
              )}
            </For>
          </HStack>
        </FieldRow>
      </Show>
      <FieldRow label="Ends">
        <Grid
          gridTemplateColumns="auto auto"
          gap="1.5"
          justifyContent="start"
          alignItems="center"
        >
          <SimpleSelect
            items={[
              { value: "count", label: "After" },
              { value: "until", label: "On date" },
            ]}
            value={d().endBy}
            onChange={(v) =>
              v && props.setDraft("endBy", v as RepeatDraft["endBy"])
            }
            size="xs"
            sameWidth={false}
            skipPortal={false}
            positioning={{ placement: "bottom-start", strategy: "fixed" }}
          />
          <Show
            when={d().endBy === "count"}
            fallback={
              <Input
                size="xs"
                type="date"
                aria-label="Until date"
                w="36"
                min={d().date}
                value={d().until}
                onInput={(e) => props.setDraft("until", e.currentTarget.value)}
              />
            }
          >
            <HStack gap="1.5">
              <Input
                size="xs"
                type="number"
                min="1"
                max="104"
                w="16"
                aria-label="Number of shows"
                value={String(d().count)}
                onInput={(e) =>
                  props.setDraft("count", Number(e.currentTarget.value) || 0)
                }
              />
              <Text textStyle="xs" color="fg.muted">
                shows
              </Text>
            </HStack>
          </Show>
        </Grid>
      </FieldRow>
    </>
  );
};
