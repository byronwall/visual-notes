import { For, Show, createMemo, createResource, createSignal, Suspense } from "solid-js";
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
    resolver?.({
      model: model() || defaultModel(),
      varsJson: varsJson(),
    });
  };

  const view = (
    <Dialog.Root open={open()} onOpenChange={handleOpenChange}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          class={css({
            maxW: "760px",
            "--dialog-base-margin": "24px",
          })}
        >
          <Dialog.Header>
            <Dialog.Title>
              {promptTask() ? `Run Prompt: ${promptTask()}` : "Run AI Prompt"}
            </Dialog.Title>
          </Dialog.Header>

          <Dialog.CloseTrigger aria-label="Close dialog" onClick={handleCancel}>
            <XIcon />
          </Dialog.CloseTrigger>

          <Dialog.Body>
            <Stack gap="3">
              <Box
                display="grid"
                gridTemplateColumns={{
                  base: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                }}
                gap="3"
              >
                <Stack gap="1">
                  <Text fontSize="xs" color="fg.muted">
                    Model
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
                      onValueChange={(details) => setModel(details.value[0] || "")}
                      size="sm"
                    >
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Default" />
                          <Select.Indicator />
                        </Select.Trigger>
                      </Select.Control>
                      <Portal>
                        <Select.Positioner>
                          <Select.Content>
                            <Select.List>
                              <For each={modelCollection().items}>
                                {(opt) => (
                                  <Select.Item item={opt}>
                                    <Select.ItemText>{opt.label}</Select.ItemText>
                                    <Select.ItemIndicator />
                                  </Select.Item>
                                )}
                              </For>
                            </Select.List>
                          </Select.Content>
                        </Select.Positioner>
                      </Portal>
                      <Select.HiddenSelect />
                    </Select.Root>
                  </Suspense>
                </Stack>

                <Stack gap="1">
                  <Text fontSize="xs" color="fg.muted">
                    Variables (JSON, optional)
                  </Text>
                  <Textarea
                    size="sm"
                    h="20"
                    fontFamily="mono"
                    placeholder='e.g. {"topic": "Rust", "audience": "beginners"}'
                    value={varsJson()}
                    onInput={(e) =>
                      setVarsJson((e.target as HTMLTextAreaElement).value)
                    }
                  />
                </Stack>
              </Box>

              <Collapsible.Root>
                <Collapsible.Trigger>
                  <HStack w="full" justifyContent="space-between" gap="2">
                    <Text fontSize="xs" fontWeight="medium">
                      Prompt details
                    </Text>
                    <Collapsible.Indicator />
                  </HStack>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <Stack gap="2">
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

              <Collapsible.Root>
                <Collapsible.Trigger>
                  <HStack w="full" justifyContent="space-between" gap="2">
                    <Text fontSize="xs" fontWeight="medium">
                      Text to be processed (selection or whole document)
                    </Text>
                    <Collapsible.Indicator />
                  </HStack>
                </Collapsible.Trigger>
                <Collapsible.Content>
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
                    {previewText()}
                  </Box>
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
              <Button size="sm" variant="solid" colorPalette="gray" onClick={handleRun}>
                Run
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );

  return { prompt, view };
}
