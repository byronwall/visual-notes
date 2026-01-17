import { Show, Suspense, createMemo, createSignal } from "solid-js";
import { PathEditor } from "~/components/PathEditor";
import { MetaKeySuggestions } from "~/components/MetaKeySuggestions";
import { MetaValueSuggestions } from "~/components/MetaValueSuggestions";
import { createDocsQueryStore } from "../state/docsQuery";
import { DateInput } from "~/components/DateInput";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import * as Checkbox from "~/components/ui/checkbox";

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

  const hasPath = createMemo(() => q.pathPrefix().trim() || q.blankPathOnly());
  const hasOriginalId = createMemo(() => q.originalContentId().trim());
  const hasMeta = createMemo(() => q.metaKey().trim() || q.metaValue().trim());
  const hasSource = createMemo(() => q.source().trim());
  const hasCreated = createMemo(() =>
    (q.createdFrom() || q.createdTo())?.trim?.()
  );
  const hasUpdated = createMemo(() =>
    (q.updatedFrom() || q.updatedTo())?.trim?.()
  );

  const isPathOpen = createMemo(() => showPath() || !!hasPath());
  const isOriginalIdOpen = createMemo(
    () => showOriginalId() || !!hasOriginalId()
  );
  const isMetaOpen = createMemo(() => showMeta() || !!hasMeta());
  const isSourceOpen = createMemo(() => showSource() || !!hasSource());
  const isCreatedOpen = createMemo(() => showCreated() || !!hasCreated());
  const isUpdatedOpen = createMemo(() => showUpdated() || !!hasUpdated());

  const toggleVariant = (active: boolean) => (active ? "subtle" : "outline");

  return (
    <Stack mt="0.5rem" gap="0.5rem">
      <HStack gap="0.5rem" flexWrap="wrap">
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
        <HStack gap="0.5rem" align="start">
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
        <HStack gap="0.5rem" align="start">
          <Text fontSize="xs" color="black.a7" width="5rem" flexShrink="0">
            Meta
          </Text>
          <Box flex="1">
            <Grid
              gridTemplateColumns="repeat(2, minmax(0, 1fr))"
              gap="0.5rem"
            >
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
                  <IconButton
                    size="xs"
                    variant="plain"
                    onClick={() => {
                      q.setMetaKey("");
                      q.setMetaValue("");
                    }}
                    title="Clear meta filters"
                    aria-label="Clear meta filters"
                    type="button"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      width="16"
                      height="16"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm2.53-10.53a.75.75 0 0 0-1.06-1.06L10 7.94 8.53 6.41a.75.75 0 1 0-1.06 1.06L8.94 9l-1.47 1.47a.75.75 0 1 0 1.06 1.06L10 10.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L11.06 9l1.47-1.47Z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </IconButton>
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
        <HStack gap="0.5rem" align="center">
          <Text fontSize="xs" color="black.a7" width="5rem" flexShrink="0">
            Source
          </Text>
          <Box
            as="select"
            flex="1"
            borderWidth="1px"
            borderColor="gray.outline.border"
            borderRadius="l2"
            px="0.5rem"
            py="0.25rem"
            fontSize="sm"
            bg="white"
            value={q.source()}
            onChange={(e) =>
              q.setSource((e.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="">All</option>
            {props.sources?.map((s) => (
              <option value={s.originalSource}>{s.originalSource}</option>
            ))}
          </Box>
          <Show when={q.source().trim()}>
            <IconButton
              size="xs"
              variant="plain"
              onClick={() => q.setSource("")}
              title="Clear source filter"
              aria-label="Clear source filter"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                width="16"
                height="16"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm2.53-10.53a.75.75 0 0 0-1.06-1.06L10 7.94 8.53 6.41a.75.75 0 1 0-1.06 1.06L8.94 9l-1.47 1.47a.75.75 0 1 0 1.06 1.06L10 10.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L11.06 9l1.47-1.47Z"
                clip-rule="evenodd"
              />
            </svg>
            </IconButton>
          </Show>
        </HStack>
      </Show>

      <Show when={isOriginalIdOpen()}>
        <HStack gap="0.5rem" align="center">
          <Text fontSize="xs" color="black.a7" width="5rem" flexShrink="0">
            Original ID
          </Text>
          <Input
            size="sm"
            placeholder="contains…"
            value={q.originalContentId()}
            onInput={(e) =>
              q.setOriginalContentId(
                (e.currentTarget as HTMLInputElement).value
              )
            }
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />
          <Show when={q.originalContentId().trim()}>
            <IconButton
              size="xs"
              variant="plain"
              onClick={() => q.setOriginalContentId("")}
              title="Clear original content ID filter"
              aria-label="Clear original content ID filter"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                width="16"
                height="16"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm2.53-10.53a.75.75 0 0 0-1.06-1.06L10 7.94 8.53 6.41a.75.75 0 1 0-1.06 1.06L8.94 9l-1.47 1.47a.75.75 0 1 0 1.06 1.06L10 10.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L11.06 9l1.47-1.47Z"
                clip-rule="evenodd"
              />
            </svg>
            </IconButton>
          </Show>
        </HStack>
      </Show>

      <Show when={isCreatedOpen()}>
        <HStack gap="0.5rem" align="center">
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
              <IconButton
                size="xs"
                variant="plain"
                onClick={() => {
                  q.setCreatedFrom(undefined);
                  q.setCreatedTo(undefined);
                }}
                title="Clear created range"
                aria-label="Clear created range"
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                width="16"
                height="16"
              >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm2.53-10.53a.75.75 0 0 0-1.06-1.06L10 7.94 8.53 6.41a.75.75 0 1 0-1.06 1.06L8.94 9l-1.47 1.47a.75.75 0 1 0 1.06 1.06L10 10.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L11.06 9l1.47-1.47Z"
                    clip-rule="evenodd"
                  />
                </svg>
              </IconButton>
            </Show>
          </HStack>
        </HStack>
      </Show>

      <Show when={isUpdatedOpen()}>
        <HStack gap="0.5rem" align="center">
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
              <IconButton
                size="xs"
                variant="plain"
                onClick={() => {
                  q.setUpdatedFrom(undefined);
                  q.setUpdatedTo(undefined);
                }}
                title="Clear updated range"
                aria-label="Clear updated range"
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                width="16"
                height="16"
              >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm2.53-10.53a.75.75 0 0 0-1.06-1.06L10 7.94 8.53 6.41a.75.75 0 1 0-1.06 1.06L8.94 9l-1.47 1.47a.75.75 0 1 0 1.06 1.06L10 10.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L11.06 9l1.47-1.47Z"
                    clip-rule="evenodd"
                  />
                </svg>
              </IconButton>
            </Show>
          </HStack>
        </HStack>
      </Show>
    </Stack>
  );
};
