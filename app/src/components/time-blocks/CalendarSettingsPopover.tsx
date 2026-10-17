import { createSignal, For } from "solid-js";
import { Box, styled } from "styled-system/jsx";
import { SettingsIcon } from "lucide-solid";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import type { CalendarSettings } from "./useCalendarSettings";

type Field = {
  label: string;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  value: () => number;
  set: (value: number) => void;
};

export const CalendarSettingsPopover = (props: {
  settings: CalendarSettings;
}) => {
  const [open, setOpen] = createSignal(false);
  const s = props.settings;
  const fields: Field[] = [
    {
      label: "Day starts",
      min: 0,
      max: 23,
      suffix: ":00",
      value: s.startHour,
      set: s.setStartHour,
    },
    {
      label: "Day ends",
      min: 1,
      max: 24,
      suffix: ":00",
      value: s.endHour,
      set: s.setEndHour,
    },
    {
      label: "Days shown",
      min: 1,
      max: 14,
      value: s.numberOfDays,
      set: s.setNumberOfDays,
    },
    {
      label: "Snap",
      min: 5,
      max: 60,
      step: 5,
      suffix: "min",
      value: s.snapMinutes,
      set: s.setSnapMinutes,
    },
    {
      label: "Hour height",
      min: 30,
      max: 140,
      step: 2,
      suffix: "px",
      value: s.hourHeight,
      set: s.setHourHeight,
    },
  ];

  return (
    <SimplePopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      offset={6}
      anchor={
        <IconButton
          size="sm"
          variant="plain"
          aria-label="Calendar settings"
          title="Calendar settings"
          onClick={() => setOpen((value) => !value)}
        >
          <SettingsIcon />
        </IconButton>
      }
    >
      <Box
        display="grid"
        gridTemplateColumns="auto auto auto"
        alignItems="center"
        columnGap="3"
        rowGap="1.5"
        p="3"
      >
        <For each={fields}>
          {(field) => (
            <>
              <styled.label
                fontSize="sm"
                color="fg.muted"
                for={`tb-setting-${field.label}`}
              >
                {field.label}
              </styled.label>
              <Input
                id={`tb-setting-${field.label}`}
                size="sm"
                type="number"
                w="20"
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                value={String(field.value())}
                onChange={(event) => {
                  field.set(Number(event.currentTarget.value));
                  event.currentTarget.value = String(field.value());
                }}
              />
              <Text fontSize="xs" color="fg.subtle" minW="7">
                {field.suffix ?? ""}
              </Text>
            </>
          )}
        </For>
      </Box>
    </SimplePopover>
  );
};
