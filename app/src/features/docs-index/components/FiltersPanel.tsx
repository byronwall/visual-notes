import { Show, Suspense, createMemo, createSignal, onMount } from "solid-js";
import { PathEditor } from "~/components/PathEditor";
import { MetaKeySuggestions } from "~/components/MetaKeySuggestions";
import { MetaValueSuggestions } from "~/components/MetaValueSuggestions";
import { createDocsQueryStore } from "../state/docsQuery";
import { DateInput } from "~/components/DateInput";
import { Button } from "~/components/ui/button";
import { ClearButton } from "~/components/ui/clear-button";
import { Input } from "~/components/ui/input";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import * as Checkbox from "~/components/ui/checkbox";
import { ActivityIcon, ArrowUpDownIcon } from "lucide-solid";

export const FiltersPanel = (props: {
  q: ReturnType<typeof createDocsQueryStore>;
  sources?: { originalSource: string; count: number }[];
}) => {
  const q = props.q;
  // Button toggles for each filter section. Sections should auto-open when in use.
  const [showPath, setShowPath] = createSignal(false);
  const [showOriginalId, setShowOriginalId] = createSignal(false);
  const [showMeta, setShowMeta] = createSignal(false);
  const [showSource, setShowSource] = createSignal(false);
  const [showCreated, setShowCreated] = createSignal(false);
  const [showUpdated, setShowUpdated] = createSignal(false);
  const [selectsReady, setSelectsReady] = createSignal(false);

  onMount(() => {
    setSelectsReady(true);
  });

  const hasPath = createMemo(() => q.pathPrefix().trim() || q.blankPathOnly());
  const hasOriginalId = createMemo(() => q.originalContentId().trim());
  const hasMeta = createMemo(() => q.metaKey().trim() || q.metaValue().trim());
  const hasSource = createMemo(() => q.source().trim());
  const hasCreated = createMemo(() =>
    (q.createdFrom() || q.createdTo())?.trim?.(),
  );
  const hasUpdated = createMemo(() =>
    (q.updatedFrom() || q.updatedTo())?.trim?.(),
  );

  const isPathOpen = createMemo(() => showPath() || !!hasPath());
  const isOriginalIdOpen = createMemo(
    () => showOriginalId() || !!hasOriginalId(),
  );
  const isMetaOpen = createMemo(() => showMeta() || !!hasMeta());
  const isSourceOpen = createMemo(() => showSource() || !!hasSource());
  const isCreatedOpen = createMemo(() => showCreated() || !!hasCreated());
  const isUpdatedOpen = createMemo(() => showUpdated() || !!hasUpdated());

  const toggleVariant = (active: boolean) => (active ? "subtle" : "outline");
  const sourceItems = createMemo<SimpleSelectItem[]>(() => [
    { label: "All", value: "" },
    ...(props.sources ?? []).map((s) => ({
      label: s.originalSource,
      value: s.originalSource,
    })),
  ]);
  const activityClassItems: SimpleSelectItem[] = [
    { label: "All activity", value: "" },
    { label: "Read-heavy", value: "READ_HEAVY" },
    { label: "Edit-heavy", value: "EDIT_HEAVY" },
    { label: "Balanced", value: "BALANCED" },
    { label: "Cold", value: "COLD" },
  ];
  const sortModeItems: SimpleSelectItem[] = [
    { label: "Relevance", value: "relevance" },
    { label: "Recent activity", value: "recent_activity" },
    { label: "Most viewed (30d)", value: "most_viewed_30d" },
    { label: "Most edited (30d)", value: "most_edited_30d" },
  ];

  return (
    <Stack mt="0.15rem" gap="1.5">
      <HStack gap="0.5rem" flexWrap="wrap" alignItems="center">
        <Show
          when={selectsReady()}
          fallback={
            <HStack gap="2" alignItems="center" flexWrap="wrap">
              <Text fontSize="xs" color="black.a7">
                Sort:{" "}
                {sortModeItems.find((item) => item.value === q.sortMode())
                  ?.label ?? "Relevance"}
              </Text>
              <Text fontSize="xs" color="black.a7">
                Activity:{" "}
                {activityClassItems.find(
                  (item) => item.value === q.activityClass(),
                )?.label ?? "All activity"}
              </Text>
            </HStack>
          }
        >
          <HStack gap="1.5" alignItems="center">
            <ArrowUpDownIcon size={14} />
            <SimpleSelect
              items={sortModeItems}
              value={q.sortMode()}
              onChange={(value) =>
                q.setSortMode(
                  value as
                    | "relevance"
                    | "recent_activity"
                    | "most_viewed_30d"
                    | "most_edited_30d",
                )
              }
              size="sm"
              sameWidth
              skipPortal
            />
          </HStack>
          <HStack gap="1.5" alignItems="center">
            <ActivityIcon size={14} />
            <SimpleSelect
              items={activityClassItems}
              value={q.activityClass()}
              onChange={(value) => q.setActivityClass(value)}
              size="sm"
              sameWidth
              skipPortal
            />
          </HStack>
        </Show>
        <Button
          type="button"
          size="xs"
          variant={toggleVariant(!!hasPath())}
          onClick={() => setShowPath((v) => !v)}
        >
          Path
        </Button>
        <Button
          type="button"
          size="xs"
          variant={toggleVariant(!!hasMeta())}
          onClick={() => setShowMeta((v) => !v)}
        >
          Meta
        </Button>
        <Button
          type="button"
          size="xs"
          variant={toggleVariant(!!hasSource())}
          onClick={() => setShowSource((v) => !v)}
        >
          Source
        </Button>
        <Button
          type="button"
          size="xs"
          variant={toggleVariant(!!hasOriginalId())}
          onClick={() => setShowOriginalId((v) => !v)}
        >
          Original ID
        </Button>
        <Button
          type="button"
          size="xs"
          variant={toggleVariant(!!hasCreated())}
          onClick={() => setShowCreated((v) => !v)}
        >
          Created
        </Button>
        <Button
          type="button"
          size="xs"
          variant={toggleVariant(!!hasUpdated())}
          onClick={() => setShowUpdated((v) => !v)}
        >
          Updated
        </Button>
      </HStack>

      <Show when={isPathOpen()}>
        <HStack gap="0.5rem" alignItems="start">
          <Text fontSize="xs" color="black.a7" width="5rem" flexShrink="0">
            Path
          </Text>
          <Stack gap="0.25rem" flex="1">
            <Box
              opacity={q.blankPathOnly() ? 0.6 : 1}
              pointerEvents={q.blankPathOnly() ? "none" : "auto"}
            >
              <PathEditor
                initialPath={q.pathPrefix()}
                onChange={(p) => q.setPathPrefix(p)}
              />
            </Box>
            <Checkbox.Root
              checked={q.blankPathOnly()}
              onCheckedChange={(details) => {
                const checked = details.checked === true;
                q.setBlankPathOnly(checked);
                if (checked) q.setPathPrefix("");
              }}
            >
              <Checkbox.HiddenInput />
              <HStack gap="0.5rem">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label>Blank only</Checkbox.Label>
              </HStack>
            </Checkbox.Root>
          </Stack>
        </HStack>
      </Show>

      <Show when={isMetaOpen()}>
        <HStack gap="0.5rem" alignItems="start">
          <Text fontSize="xs" color="black.a7" width="5rem" flexShrink="0">
            Meta
          </Text>
          <Box flex="1">
            <Grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="0.5rem">
              <Input
                size="sm"
                placeholder="key (e.g. tag)"
                value={q.metaKey()}
                onInput={(e) =>
                  q.setMetaKey((e.currentTarget as HTMLInputElement).value)
                }
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
              />
              <HStack gap="0.5rem">
                <Input
                  size="sm"
                  flex="1"
                  placeholder="value"
                  value={q.metaValue()}
                  onInput={(e) =>
                    q.setMetaValue((e.currentTarget as HTMLInputElement).value)
                  }
                  autocomplete="off"
                  autocapitalize="none"
                  autocorrect="off"
                  spellcheck={false}
                />
                <Show when={q.metaKey().trim() || q.metaValue().trim()}>
                  <ClearButton
                    onClick={() => {
                      q.setMetaKey("");
                      q.setMetaValue("");
                    }}
                    label="Clear meta filters"
                  />
                </Show>
              </HStack>
            </Grid>
            <Box mt="0.25rem">
              <Suspense fallback={null}>
                <MetaKeySuggestions onSelect={(key) => q.setMetaKey(key)} />
              </Suspense>
              <Suspense fallback={null}>
                <MetaValueSuggestions
                  keyName={q.metaKey()}
                  onSelect={(v) => q.setMetaValue(v)}
                />
              </Suspense>
            </Box>
          </Box>
        </HStack>
      </Show>

      <Show when={isSourceOpen()}>
        <HStack gap="0.5rem" alignItems="center">
          <Box flex="1">
            <SimpleSelect
              items={sourceItems()}
              value={q.source()}
              onChange={(value) => q.setSource(value)}
              label="Source"
              labelPlacement="inline"
              labelProps={{
                fontSize: "xs",
                color: "black.a7",
                width: "5rem",
                flexShrink: "0",
              }}
              size="sm"
              sameWidth
            />
          </Box>
          <Show when={q.source().trim()}>
            <ClearButton
              onClick={() => q.setSource("")}
              label="Clear source filter"
            />
          </Show>
        </HStack>
      </Show>

      <Show when={isOriginalIdOpen()}>
        <HStack gap="0.5rem" alignItems="center">
          <Text fontSize="xs" color="black.a7" width="5rem" flexShrink="0">
            Original ID
          </Text>
          <Input
            size="sm"
            placeholder="contains…"
            value={q.originalContentId()}
            onInput={(e) =>
              q.setOriginalContentId(
                (e.currentTarget as HTMLInputElement).value,
              )
            }
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />
          <Show when={q.originalContentId().trim()}>
            <ClearButton
              onClick={() => q.setOriginalContentId("")}
              label="Clear original content ID filter"
            />
          </Show>
        </HStack>
      </Show>

      <Show when={isCreatedOpen()}>
        <HStack gap="0.5rem" alignItems="center">
          <Text fontSize="xs" color="black.a7" width="5rem" flexShrink="0">
            Created
          </Text>
          <HStack gap="0.5rem">
            <DateInput
              value={q.createdFrom() || undefined}
              onChange={(v) => q.setCreatedFrom(v)}
              aria-label="Created from"
            />
            <DateInput
              value={q.createdTo() || undefined}
              onChange={(v) => q.setCreatedTo(v)}
              aria-label="Created to"
            />
            <Show when={(q.createdFrom() || q.createdTo())?.trim?.()}>
              <ClearButton
                onClick={() => {
                  q.setCreatedFrom(undefined);
                  q.setCreatedTo(undefined);
                }}
                label="Clear created range"
              />
            </Show>
          </HStack>
        </HStack>
      </Show>

      <Show when={isUpdatedOpen()}>
        <HStack gap="0.5rem" alignItems="center">
          <Text fontSize="xs" color="black.a7" width="5rem" flexShrink="0">
            Updated
          </Text>
          <HStack gap="0.5rem">
            <DateInput
              value={q.updatedFrom() || undefined}
              onChange={(v) => q.setUpdatedFrom(v)}
              aria-label="Updated from"
            />
            <DateInput
              value={q.updatedTo() || undefined}
              onChange={(v) => q.setUpdatedTo(v)}
              aria-label="Updated to"
            />
            <Show when={(q.updatedFrom() || q.updatedTo())?.trim?.()}>
              <ClearButton
                onClick={() => {
                  q.setUpdatedFrom(undefined);
                  q.setUpdatedTo(undefined);
                }}
                label="Clear updated range"
              />
            </Show>
          </HStack>
        </HStack>
      </Show>
    </Stack>
  );
};
