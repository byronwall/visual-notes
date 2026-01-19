import {
  Show,
  Suspense,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";
import { apiFetch } from "~/utils/base-url";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import * as Collapsible from "~/components/ui/collapsible";
import { SimpleDialog } from "~/components/ui/simple-dialog";

type ModelsResponse = { items: string[] };

async function fetchModels(): Promise<string[]> {
  const res = await apiFetch("/api/ai/models");
  const data = (await res.json()) as ModelsResponse;
  return data.items || [];
}

export type AiRunPayload = {
  model?: string;
  varsJson?: string;
};

export function useAiPromptModal() {
  const [open, setOpen] = createSignal(false);
  const [defaultModel, setDefaultModel] = createSignal<string | undefined>(
    undefined
  );

  const [model, setModel] = createSignal<string>("");
  const [varsJson, setVarsJson] = createSignal<string>("");
  const [previewText, setPreviewText] = createSignal<string>("");
  const [promptTask, setPromptTask] = createSignal<string>("");
  const [promptSystem, setPromptSystem] = createSignal<string | undefined>();
  const [promptTemplate, setPromptTemplate] = createSignal<string>("");

  const [models] = createResource(fetchModels);
  let resolver: ((p: AiRunPayload | "cancel") => void) | undefined;

  const modelItems = createMemo<SimpleSelectItem[]>(() => {
    const items: SimpleSelectItem[] = [];
    const defaultValue = defaultModel() || "";
    if (defaultValue) {
      items.push({ label: defaultValue, value: defaultValue });
    } else {
      items.push({ label: "Default", value: "" });
    }
    for (const m of models() || []) {
      if (m === defaultValue) continue;
      items.push({ label: m, value: m });
    }
    return items;
  });

  const varsJsonError = createMemo(() => {
    const raw = varsJson().trim();
    if (!raw) return undefined;
    try {
      JSON.parse(raw);
      return undefined;
    } catch (e) {
      return (e as Error)?.message || "Invalid JSON";
    }
  });

  const inputCharCount = createMemo(() => previewText()?.length || 0);

  const prompt = (opts: {
    defaultModel?: string;
    previewText: string;
    details?: { task: string; system?: string | null; template: string };
  }) =>
    new Promise<AiRunPayload | "cancel">((resolve) => {
      console.log(
        "[ai-modal] open with preview length:",
        opts.previewText?.length || 0
      );
      setDefaultModel(opts.defaultModel);
      setModel(opts.defaultModel || "");
      setVarsJson("");
      setPreviewText(opts.previewText || "");
      setPromptTask(opts.details?.task || "");
      setPromptSystem(opts.details?.system ?? undefined);
      setPromptTemplate(opts.details?.template || "");
      setOpen(true);
      resolver = (p) => {
        setOpen(false);
        resolve(p);
      };
    });

  const handleCancel = () => {
    resolver?.("cancel");
  };

  const handleRun = () => {
    if (varsJsonError()) return;
    resolver?.({
      model: model() || defaultModel(),
      varsJson: varsJson(),
    });
  };

  const view = (
    <SimpleDialog
      open={open()}
      onClose={handleCancel}
      title={promptTask() ? `Run Prompt: ${promptTask()}` : "Run AI Prompt"}
      description="Review settings, optionally add variables, then run on your current selection (or the whole document if nothing is selected). The output will open in the AI sidebar."
      maxW="920px"
      footer={
        <HStack gap="2" justifyContent="flex-end" w="full">
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="solid"
            colorPalette="gray"
            onClick={handleRun}
            disabled={!!varsJsonError()}
          >
            Run
          </Button>
        </HStack>
      }
    >
      <Stack gap="4">
        <Box
          display="grid"
          gridTemplateColumns={{
            base: "1fr",
            md: "minmax(0, 360px) minmax(0, 1fr)",
          }}
          gap="4"
        >
          <Stack gap="3">
            <Text fontSize="xs" fontWeight="semibold">
              Settings
            </Text>

            <Stack gap="1">
              <Suspense
                fallback={
                  <Text fontSize="xs" color="fg.muted">
                    Loading models…
                  </Text>
                }
              >
                <SimpleSelect
                  items={modelItems()}
                  value={model() || defaultModel() || ""}
                  onChange={(value) => setModel(value)}
                  label="Model"
                  labelProps={{ fontSize: "xs", color: "fg.muted" }}
                  size="sm"
                  placeholder="Default"
                  skipPortal
                />
              </Suspense>
              <Text fontSize="xs" color="fg.muted">
                Choose a model override for this run.
              </Text>
            </Stack>

            <Stack gap="1">
              <Text fontSize="xs" color="fg.muted">
                Variables (JSON, optional)
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Used to fill placeholders in the prompt template. Leave empty to
                run with defaults.
              </Text>
              <Textarea
                size="sm"
                h="24"
                fontFamily="mono"
                placeholder='e.g. {"topic": "Rust", "audience": "beginners"}'
                value={varsJson()}
                onInput={(e) =>
                  setVarsJson((e.target as HTMLTextAreaElement).value)
                }
              />
              <Show when={varsJsonError()}>
                {(err) => (
                  <Text fontSize="xs" color="red.11">
                    Invalid JSON: {err()}
                  </Text>
                )}
              </Show>
            </Stack>
          </Stack>

          <Stack gap="2">
            <HStack justifyContent="space-between" gap="3">
              <Text fontSize="xs" fontWeight="semibold">
                Input
              </Text>
              <Text
                fontSize="xs"
                color="fg.muted"
                fontVariantNumeric="tabular-nums"
              >
                {inputCharCount().toLocaleString()} chars
              </Text>
            </HStack>
            <Text fontSize="xs" color="fg.muted">
              This is the text that will be sent to the prompt (selection if
              present, otherwise the whole document).
            </Text>
            <Box
              as="pre"
              borderWidth="1px"
              borderColor="gray.outline.border"
              borderRadius="l2"
              p="3"
              fontSize="xs"
              maxH="18rem"
              overflow="auto"
              whiteSpace="pre-wrap"
            >
              {previewText()}
            </Box>
          </Stack>
        </Box>

        <Collapsible.Root>
          <Collapsible.Trigger>
            <HStack w="full" justifyContent="space-between" gap="2">
              <Stack gap="0.5">
                <Text fontSize="xs" fontWeight="medium">
                  Prompt details (read-only)
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  Helpful when debugging a run.
                </Text>
              </Stack>
              <Collapsible.Indicator />
            </HStack>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <Stack gap="2" mt="2">
              <Stack gap="1">
                <Text fontSize="xs" color="fg.muted">
                  Task
                </Text>
                <Box
                  as="pre"
                  borderWidth="1px"
                  borderColor="gray.outline.border"
                  borderRadius="l2"
                  p="2"
                  fontSize="xs"
                  maxH="4rem"
                  overflow="auto"
                  whiteSpace="pre-wrap"
                >
                  {promptTask()}
                </Box>
              </Stack>

              <Stack gap="1">
                <Text fontSize="xs" color="fg.muted">
                  User template
                </Text>
                <Box
                  as="pre"
                  borderWidth="1px"
                  borderColor="gray.outline.border"
                  borderRadius="l2"
                  p="2"
                  fontSize="xs"
                  maxH="10rem"
                  overflow="auto"
                  whiteSpace="pre-wrap"
                >
                  {promptTemplate()}
                </Box>
              </Stack>

              <Show when={promptSystem()}>
                {(system) => (
                  <Stack gap="1">
                    <Text fontSize="xs" color="fg.muted">
                      System prompt
                    </Text>
                    <Box
                      as="pre"
                      borderWidth="1px"
                      borderColor="gray.outline.border"
                      borderRadius="l2"
                      p="2"
                      fontSize="xs"
                      maxH="7rem"
                      overflow="auto"
                      whiteSpace="pre-wrap"
                    >
                      {system()}
                    </Box>
                  </Stack>
                )}
              </Show>
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      </Stack>
    </SimpleDialog>
  );

  return { prompt, view };
}
