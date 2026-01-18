import {
  For,
  Show,
  Suspense,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";
import { Portal } from "solid-js/web";
import { apiFetch } from "~/utils/base-url";
import { css } from "styled-system/css";
import * as Select from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import * as Collapsible from "~/components/ui/collapsible";
import * as Dialog from "~/components/ui/dialog";
import { XIcon } from "lucide-solid";

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

  type SelectItem = { label: string; value: string };
  const modelCollection = createMemo(() => {
    const items: SelectItem[] = [];
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
    return Select.createListCollection<SelectItem>({ items });
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

  const handleOpenChange = (details: { open?: boolean }) => {
    if (details?.open === false) {
      resolver?.("cancel");
    }
  };

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
    <Dialog.Root open={open()} onOpenChange={handleOpenChange}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            class={css({
              maxW: "920px",
              "--dialog-base-margin": "24px",
            })}
          >
            <Dialog.Header>
              <Stack gap="1">
                <Dialog.Title>
                  {promptTask()
                    ? `Run Prompt: ${promptTask()}`
                    : "Run AI Prompt"}
                </Dialog.Title>
                <Dialog.Description>
                  Review settings, optionally add variables, then run on your
                  current selection (or the whole document if nothing is
                  selected). The output will open in the AI sidebar.
                </Dialog.Description>
              </Stack>
            </Dialog.Header>

            <Dialog.CloseTrigger
              aria-label="Close dialog"
              onClick={handleCancel}
            >
              <XIcon />
            </Dialog.CloseTrigger>

            <Dialog.Body>
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
                      <Text fontSize="xs" color="fg.muted">
                        Model
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        Choose a model override for this run.
                      </Text>
                      <Suspense
                        fallback={
                          <Text fontSize="xs" color="fg.muted">
                            Loading models…
                          </Text>
                        }
                      >
                        <Select.Root
                          collection={modelCollection()}
                          value={[model() || defaultModel() || ""]}
                          onValueChange={(details) =>
                            setModel(details.value[0] || "")
                          }
                          size="sm"
                        >
                          <Select.Control>
                            <Select.Trigger>
                              <Select.ValueText placeholder="Default" />
                              <Select.Indicator />
                            </Select.Trigger>
                          </Select.Control>

                          <Select.Positioner>
                            <Select.Content>
                              <Select.List>
                                <For each={modelCollection().items}>
                                  {(opt) => (
                                    <Select.Item item={opt}>
                                      <Select.ItemText>
                                        {opt.label}
                                      </Select.ItemText>
                                      <Select.ItemIndicator />
                                    </Select.Item>
                                  )}
                                </For>
                              </Select.List>
                            </Select.Content>
                          </Select.Positioner>

                          <Select.HiddenSelect />
                        </Select.Root>
                      </Suspense>
                    </Stack>

                    <Stack gap="1">
                      <Text fontSize="xs" color="fg.muted">
                        Variables (JSON, optional)
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        Used to fill placeholders in the prompt template. Leave
                        empty to run with defaults.
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
                      This is the text that will be sent to the prompt
                      (selection if present, otherwise the whole document).
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
            </Dialog.Body>

            <Dialog.Footer>
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
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );

  return { prompt, view };
}
