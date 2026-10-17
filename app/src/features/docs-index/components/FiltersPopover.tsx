import { Show, Suspense, createMemo, createSignal, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { ListFilterIcon } from "lucide-solid";
import { PathEditor } from "~/components/PathEditor";
import { MetaKeySuggestions } from "~/components/MetaKeySuggestions";
import { MetaValueSuggestions } from "~/components/MetaValueSuggestions";
import { DateInput } from "~/components/DateInput";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import * as Popover from "~/components/ui/popover";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import * as Checkbox from "~/components/ui/checkbox";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import type { DocsQueryStore } from "../state/docsQuery";

const textInputProps = {
  autocomplete: "off",
  autocapitalize: "none",
  autocorrect: "off",
  spellcheck: false,
} as const;

const FilterRow = (props: { label: string; children: JSX.Element }) => (
  <Grid gridTemplateColumns="5.5rem minmax(0, 1fr)" gap="3" alignItems="start">
    <Box fontSize="xs" color="fg.muted" pt="2">
      {props.label}
    </Box>
    <Box minW="0">{props.children}</Box>
  </Grid>
);

export const FiltersPopover = (props: {
  q: DocsQueryStore;
  sources?: { originalSource: string; count: number }[];
  activeCount: number;
}) => {
  const q = props.q;
  const [open, setOpen] = createSignal(false);
  const sourceItems = createMemo<SimpleSelectItem[]>(() => [
    { label: "Any source", value: "" },
    ...(props.sources ?? []).map((s) => ({
      label: `${s.originalSource} (${s.count})`,
      value: s.originalSource,
    })),
  ]);

  return (
    <Popover.Root
      open={open()}
      onOpenChange={(d) => setOpen(d.open)}
      positioning={{ placement: "bottom-start", offset: { mainAxis: 6 } }}
    >
      <Popover.Trigger
        asChild={(triggerProps) => (
          <Button
            {...triggerProps}
            size="xs"
            variant={props.activeCount > 0 ? "subtle" : "plain"}
          >
            <ListFilterIcon size={14} />
            Filter
            <Show when={props.activeCount > 0}>
              <Box as="span" color="fg.muted" fontVariantNumeric="tabular-nums">
                {props.activeCount}
              </Box>
            </Show>
          </Button>
        )}
      />
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            p="4"
            width="auto"
            maxW="calc(100vw - 2rem)"
            overflowY="auto"
          >
            <Stack gap="3" w="30rem" maxW="full">
              <FilterRow label="Path">
                <Stack gap="1.5">
                  <Box
                    opacity={q.blankPathOnly() ? 0.5 : 1}
                    pointerEvents={q.blankPathOnly() ? "none" : "auto"}
                  >
                    <PathEditor
                      initialPath={q.pathPrefix()}
                      onChange={(p) => q.setPathPrefix(p)}
                    />
                  </Box>
                  <Checkbox.Root
                    size="sm"
                    checked={q.blankPathOnly()}
                    onCheckedChange={(details) => {
                      const checked = details.checked === true;
                      q.setBlankPathOnly(checked);
                      if (checked) q.setPathPrefix("");
                    }}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label fontSize="xs">
                      Only notes without a path
                    </Checkbox.Label>
                  </Checkbox.Root>
                </Stack>
              </FilterRow>

              <FilterRow label="Meta">
                <Stack gap="1.5">
                  <Grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
                    <Input
                      size="xs"
                      placeholder="key"
                      value={q.metaKey()}
                      onInput={(e) => q.setMetaKey(e.currentTarget.value)}
                      {...textInputProps}
                    />
                    <Input
                      size="xs"
                      placeholder="value"
                      value={q.metaValue()}
                      onInput={(e) => q.setMetaValue(e.currentTarget.value)}
                      {...textInputProps}
                    />
                  </Grid>
                  <Suspense fallback={null}>
                    <MetaKeySuggestions
                      limit={6}
                      onSelect={(key) => q.setMetaKey(key)}
                    />
                  </Suspense>
                  <Suspense fallback={null}>
                    <MetaValueSuggestions
                      keyName={q.metaKey()}
                      onSelect={(v) => q.setMetaValue(v)}
                    />
                  </Suspense>
                </Stack>
              </FilterRow>

              <FilterRow label="Source">
                <SimpleSelect
                  items={sourceItems()}
                  value={q.source()}
                  onChange={(value) => q.setSource(value)}
                  size="xs"
                  sameWidth
                  skipPortal
                />
              </FilterRow>

              <FilterRow label="Original ID">
                <Input
                  size="xs"
                  placeholder="contains…"
                  value={q.originalContentId()}
                  onInput={(e) => q.setOriginalContentId(e.currentTarget.value)}
                  {...textInputProps}
                />
              </FilterRow>

              <FilterRow label="Created">
                <HStack gap="2">
                  <DateInput
                    value={q.createdFrom() || undefined}
                    onChange={(v) => q.setCreatedFrom(v)}
                    aria-label="Created from"
                  />
                  <Box color="fg.subtle">–</Box>
                  <DateInput
                    value={q.createdTo() || undefined}
                    onChange={(v) => q.setCreatedTo(v)}
                    aria-label="Created to"
                  />
                </HStack>
              </FilterRow>

              <FilterRow label="Updated">
                <HStack gap="2">
                  <DateInput
                    value={q.updatedFrom() || undefined}
                    onChange={(v) => q.setUpdatedFrom(v)}
                    aria-label="Updated from"
                  />
                  <Box color="fg.subtle">–</Box>
                  <DateInput
                    value={q.updatedTo() || undefined}
                    onChange={(v) => q.setUpdatedTo(v)}
                    aria-label="Updated to"
                  />
                </HStack>
              </FilterRow>

              <HStack justify="space-between" pt="1">
                <Button
                  size="xs"
                  variant="plain"
                  disabled={!q.hasFilters()}
                  onClick={() => q.resetFilters()}
                >
                  Clear all
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Done
                </Button>
              </HStack>
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
