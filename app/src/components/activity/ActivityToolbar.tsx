import { SlidersHorizontalIcon } from "lucide-solid";
import { For, Show, createEffect, createSignal, on, onCleanup } from "solid-js";
import { Box, Grid, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimplePopover } from "~/components/ui/simple-popover";
import { ACTIVITY_DOMAINS } from "./activity-format";
import type { ActivityFilters } from "./useActivityFilters";

type ActivityToolbarProps = {
  filters: ActivityFilters;
};

const PATH_DEBOUNCE_MS = 300;

const advancedFields = [
  {
    key: "event",
    label: "Event type",
    placeholder: "doc.update",
    mono: true,
    type: "text",
  },
  {
    key: "actor",
    label: "Actor",
    placeholder: "magic_…",
    mono: true,
    type: "text",
  },
  {
    key: "doc",
    label: "Note ID",
    placeholder: "cm…",
    mono: true,
    type: "text",
  },
  {
    key: "tool",
    label: "MCP tool",
    placeholder: "notes_get",
    mono: true,
    type: "text",
  },
  {
    key: "call",
    label: "MCP call ID",
    placeholder: "uuid",
    mono: true,
    type: "text",
  },
  {
    key: "from",
    label: "From",
    placeholder: "",
    mono: false,
    type: "datetime-local",
  },
  {
    key: "to",
    label: "To",
    placeholder: "",
    mono: false,
    type: "datetime-local",
  },
] as const;

export const ActivityToolbar = (props: ActivityToolbarProps) => {
  const filters = () => props.filters;
  const [pathDraft, setPathDraft] = createSignal(filters().pathPrefix());
  const [moreOpen, setMoreOpen] = createSignal(false);
  let pathTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(pathTimer));

  // Keep the draft in sync when the URL changes from elsewhere (reset, back).
  createEffect(
    on(
      () => filters().pathPrefix(),
      (value) => setPathDraft(value),
    ),
  );

  const handlePathInput = (value: string) => {
    setPathDraft(value);
    clearTimeout(pathTimer);
    pathTimer = setTimeout(
      () => filters().setParam("path", value),
      PATH_DEBOUNCE_MS,
    );
  };

  return (
    <HStack gap="2" flexWrap="wrap" alignItems="center">
      <HStack
        gap="0.5"
        bg="bg.subtle"
        borderRadius="l2"
        p="0.5"
        role="tablist"
        aria-label="Event family"
      >
        <For each={ACTIVITY_DOMAINS}>
          {(option) => {
            const active = () => filters().domain() === option.value;
            return (
              <Button
                size="xs"
                variant="plain"
                role="tab"
                aria-selected={active()}
                bg={active() ? "bg.default" : "transparent"}
                color={active() ? "fg.default" : "fg.muted"}
                boxShadow={active() ? "xs" : "none"}
                _hover={{
                  color: "fg.default",
                  bg: active() ? "bg.default" : "bg.muted",
                }}
                onClick={() =>
                  filters().setParam(
                    "type",
                    option.value === "all" ? "" : option.value,
                  )
                }
              >
                {option.label}
              </Button>
            );
          }}
        </For>
      </HStack>

      <Input
        size="sm"
        w={{ base: "full", sm: "56" }}
        fontFamily="mono"
        placeholder="Path prefix, e.g. work.projects"
        aria-label="Filter by note path prefix"
        value={pathDraft()}
        onInput={(event) => handlePathInput(event.currentTarget.value)}
      />

      <SimplePopover
        open={moreOpen()}
        onClose={() => setMoreOpen(false)}
        placement="bottom-start"
        offset={6}
        style={{ width: "fit-content", "max-width": "calc(100vw - 2rem)" }}
        anchor={
          <Button
            size="sm"
            variant="plain"
            color={filters().advancedCount() > 0 ? "fg.default" : "fg.muted"}
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen()}
          >
            <SlidersHorizontalIcon size={14} />
            More filters
            <Show when={filters().advancedCount() > 0}>
              <Box
                as="span"
                fontSize="xs"
                color="grass.11"
                fontWeight="semibold"
              >
                {filters().advancedCount()}
              </Box>
            </Show>
          </Button>
        }
      >
        <Grid
          gridTemplateColumns={{
            base: "minmax(0, 16rem)",
            sm: "repeat(2, minmax(0, 14rem))",
          }}
          gap="3"
          p="1"
        >
          <For each={advancedFields}>
            {(field) => (
              <Field.Root>
                <Field.Label fontSize="xs" color="fg.muted">
                  {field.label}
                </Field.Label>
                <Input
                  size="sm"
                  type={field.type}
                  fontFamily={field.mono ? "mono" : undefined}
                  placeholder={field.placeholder}
                  value={filters().advanced(field.key)}
                  onChange={(event) =>
                    filters().setParam(field.key, event.currentTarget.value)
                  }
                />
              </Field.Root>
            )}
          </For>
        </Grid>
      </SimplePopover>

      <Show when={filters().hasAnyFilter()}>
        <Button
          size="sm"
          variant="plain"
          color="fg.muted"
          onClick={() => filters().clearAll()}
        >
          Clear
        </Button>
      </Show>
    </HStack>
  );
};
