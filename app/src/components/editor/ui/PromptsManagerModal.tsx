import { For, Show, Suspense, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { createAsync, revalidate, useAction } from "@solidjs/router";
import { usePromptDesignerModal } from "./PromptDesignerModal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Text } from "~/components/ui/text";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { fetchPrompts } from "~/services/prompts/prompts.queries";
import { createPromptVersion, createPrompt, revisePrompt } from "~/services/prompts/prompts.actions";

type Prompt = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  defaultTemp: number;
  defaultTopP?: number | null;
  activeVersion?: {
    id: string;
    template: string;
    system?: string | null;
  } | null;
};
export function usePromptsManagerModal() {
  const [open, setOpen] = createSignal(false);
  const prompts = createAsync(() => fetchPrompts());
  const runCreatePrompt = useAction(createPrompt);
  const runCreateVersion = useAction(createPromptVersion);
  const runRevise = useAction(revisePrompt);

  const refreshPrompts = async () => {
    await revalidate(fetchPrompts.key);
  };

  const [newTask, setNewTask] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");
  const [newTemplate, setNewTemplate] = createSignal("");
  const [newSystem, setNewSystem] = createSignal("");

  // Per-prompt edit/revise local state
  const [byId, setById] = createStore<
    Record<
      string,
      {
        inited?: boolean;
        editTemplate: string;
        editSystem: string;
        busyEdit?: boolean;
        feedback: string;
        busyRevise?: boolean;
        suggestedTemplate: string;
        suggestedSystem: string;
      }
    >
  >({});

  const openModal = () => {
    setOpen(true);
  };
  const close = () => setOpen(false);

  const selectionMissing = () => newTemplate().indexOf("{{selection") === -1;

  const onInsertSelectionVar = () => {
    const t = newTemplate();
    const needsGap = !t.endsWith("\n");
    const appended = `${t}${needsGap ? "\n\n" : ""}{{selection}}`;
    setNewTemplate(appended);
  };

  const onCreatePrompt = async () => {
    const task = newTask().trim();
    const template = newTemplate().trim();
    if (!task || !template) return;
    await runCreatePrompt({
      task,
      description: newDesc() || undefined,
      template,
      system: newSystem() || undefined,
      activate: true,
    });
    await refreshPrompts();
    setNewTask("");
    setNewDesc("");
    setNewTemplate("");
    setNewSystem("");
  };

  const onAddVersion = async (
    id: string,
    template: string,
    system?: string
  ) => {
    await runCreateVersion({
      promptId: id,
      template,
      system: system || undefined,
      activate: true,
    });
    await refreshPrompts();
  };

  const initEditFor = (p: Prompt) => {
    const av = p.activeVersion;
    if (!av) return;
    if (byId[p.id]?.inited) return;
    setById(p.id, {
      inited: true,
      editTemplate: av.template || "",
      editSystem: av.system || "",
      busyEdit: false,
      feedback: "",
      busyRevise: false,
      suggestedTemplate: "",
      suggestedSystem: "",
    });
  };

  const onSaveNewVersion = async (p: Prompt, activate: boolean) => {
    const state = byId[p.id];
    const template = (state?.editTemplate || "").trim();
    const system = (state?.editSystem || "").trim();
    if (!template) return;
    setById(p.id, "busyEdit", true);
    try {
      await runCreateVersion({
        promptId: p.id,
        template,
        system: system || undefined,
        activate,
      });
      await refreshPrompts();
    } finally {
      setById(p.id, "busyEdit", false);
    }
  };

  const onRevise = async (p: Prompt) => {
    const fb = (byId[p.id]?.feedback || "").trim();
    if (!fb) return;
    setById(p.id, "busyRevise", true);
    try {
      const data = await runRevise({ promptId: p.id, feedback: fb });
      if (!data?.suggestion) return;
      setById(p.id, "suggestedTemplate", data.suggestion.template || "");
      setById(p.id, "suggestedSystem", data.suggestion.system || "");
    } finally {
      setById(p.id, "busyRevise", false);
    }
  };

  const onAcceptSuggestion = async (p: Prompt, activate: boolean) => {
    const template = (byId[p.id]?.suggestedTemplate || "").trim();
    const system = (byId[p.id]?.suggestedSystem || "").trim();
    if (!template) return;
    setById(p.id, "busyRevise", true);
    try {
      await runCreateVersion({
        promptId: p.id,
        template,
        system: system || undefined,
        activate,
      });
      await refreshPrompts();
      setById(p.id, {
        ...byId[p.id],
        feedback: "",
        suggestedTemplate: "",
        suggestedSystem: "",
      });
    } finally {
      setById(p.id, "busyRevise", false);
    }
  };

  const view = (
    <SimpleDialog
      open={open()}
      onClose={close}
      title="Manage Prompts"
      maxW="1100px"
      footer={
        <HStack justifyContent="flex-end" w="full">
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={close}
          >
            Close
          </Button>
        </HStack>
      }
    >
      <Grid
        gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }}
        gap="4"
      >
        <Stack gap="2">
          <Text fontSize="xs" fontWeight="medium">
            Create new
          </Text>
          <DesignerLaunch
            onCreated={() => {
              void refreshPrompts();
            }}
          />
          <Input
            size="sm"
            placeholder="task (unique)"
            value={newTask()}
            onInput={(e) => setNewTask((e.target as HTMLInputElement).value)}
          />
          <Input
            size="sm"
            placeholder="description"
            value={newDesc()}
            onInput={(e) => setNewDesc((e.target as HTMLInputElement).value)}
          />
          <Textarea
            size="sm"
            h="28"
            fontFamily="mono"
            placeholder="template (Mustache)"
            value={newTemplate()}
            onInput={(e) =>
              setNewTemplate((e.target as HTMLTextAreaElement).value)
            }
          />
          <Show when={selectionMissing()}>
            <Stack gap="1" mt="1">
              <Text fontSize="xs" color="amber.11">
                Template is missing {"{{selection}}"}. It will be appended
                automatically when running, but you can insert it now.
              </Text>
              <Button
                size="xs"
                variant="outline"
                colorPalette="gray"
                onClick={onInsertSelectionVar}
              >
                Insert {"{{selection}}"}
              </Button>
            </Stack>
          </Show>
          <Textarea
            size="sm"
            h="16"
            fontFamily="mono"
            placeholder="system (optional)"
            value={newSystem()}
            onInput={(e) =>
              setNewSystem((e.target as HTMLTextAreaElement).value)
            }
          />
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={onCreatePrompt}
          >
            Create & Activate
          </Button>
        </Stack>
        <Stack gap="2">
          <Text fontSize="xs" fontWeight="medium">
            Existing
          </Text>
          <Suspense
            fallback={
              <Text fontSize="xs" color="fg.muted">
                Loading…
              </Text>
            }
          >
            <Stack gap="3">
              <For each={prompts() || []}>
                {(p) => (
                  <Stack
                    gap="2"
                    borderWidth="1px"
                    borderColor="gray.outline.border"
                    borderRadius="l2"
                    p="2"
                  >
                    <Text fontSize="xs" fontWeight="semibold">
                      {p.task}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {p.description}
                    </Text>
                    <HStack gap="1">
                      <Text fontSize="xs" color="fg.muted">
                        Active version:
                      </Text>
                      <Text fontSize="xs" fontFamily="mono">
                        {p.activeVersion?.id || "—"}
                      </Text>
                    </HStack>
                    <Show when={p.activeVersion}>
                      {(av) => (
                        <Box as="details">
                          <Text as="summary" fontSize="xs" cursor="pointer">
                            Active template
                          </Text>
                          <Box
                            as="pre"
                            mt="2"
                            borderWidth="1px"
                            borderColor="gray.outline.border"
                            borderRadius="l2"
                            bg="gray.surface.bg"
                            p="2"
                            fontSize="xs"
                            whiteSpace="pre-wrap"
                          >
                            {av().template}
                          </Box>
                        </Box>
                      )}
                    </Show>
                    <Button
                      size="xs"
                      variant="outline"
                      colorPalette="gray"
                      onClick={() =>
                        onAddVersion(
                          p.id,
                          p.activeVersion?.template || "",
                          p.activeVersion?.system || undefined
                        )
                      }
                    >
                      Duplicate Active → New Version (Activate)
                    </Button>
                    <Show when={p.activeVersion}>
                      {(av) => (
                        <Box
                          as="details"
                          onToggle={(e) => {
                            if ((e.target as HTMLDetailsElement).open)
                              initEditFor(p);
                          }}
                        >
                          <Text as="summary" fontSize="xs" cursor="pointer">
                            Edit → New Version
                          </Text>
                          <Stack gap="2" mt="2">
                            <Text fontSize="xs" color="fg.muted">
                              Template
                            </Text>
                            <Textarea
                              size="sm"
                              h="32"
                              fontFamily="mono"
                              value={
                                byId[p.id]?.editTemplate || av().template || ""
                              }
                              onInput={(e) =>
                                setById(
                                  p.id,
                                  "editTemplate",
                                  (e.target as HTMLTextAreaElement).value
                                )
                              }
                            />
                            <Text fontSize="xs" color="fg.muted">
                              System (optional)
                            </Text>
                            <Textarea
                              size="sm"
                              h="20"
                              fontFamily="mono"
                              value={
                                byId[p.id]?.editSystem || av().system || ""
                              }
                              onInput={(e) =>
                                setById(
                                  p.id,
                                  "editSystem",
                                  (e.target as HTMLTextAreaElement).value
                                )
                              }
                            />
                            <HStack gap="2">
                              <Button
                                size="xs"
                                variant="outline"
                                colorPalette="gray"
                                disabled={!!byId[p.id]?.busyEdit}
                                onClick={() => onSaveNewVersion(p, false)}
                              >
                                Save as New Version
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                colorPalette="gray"
                                disabled={!!byId[p.id]?.busyEdit}
                                onClick={() => onSaveNewVersion(p, true)}
                              >
                                Save & Activate
                              </Button>
                            </HStack>
                          </Stack>
                        </Box>
                      )}
                    </Show>
                    <Box as="details">
                      <Text as="summary" fontSize="xs" cursor="pointer">
                        Revise with Feedback (LLM)
                      </Text>
                      <Stack gap="2" mt="2">
                        <Textarea
                          size="sm"
                          h="16"
                          placeholder="What should be improved?"
                          value={byId[p.id]?.feedback || ""}
                          onInput={(e) =>
                            setById(
                              p.id,
                              "feedback",
                              (e.target as HTMLTextAreaElement).value
                            )
                          }
                        />
                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="gray"
                          disabled={!!byId[p.id]?.busyRevise}
                          onClick={() => onRevise(p)}
                        >
                          Generate Suggestion
                        </Button>
                        <Show
                          when={
                            (byId[p.id]?.suggestedTemplate || "").length > 0
                          }
                        >
                          <Stack gap="2" mt="2">
                            <Text fontSize="xs" color="fg.muted">
                              Suggested Template
                            </Text>
                            <Textarea
                              size="sm"
                              h="28"
                              fontFamily="mono"
                              value={byId[p.id]?.suggestedTemplate || ""}
                              onInput={(e) =>
                                setById(
                                  p.id,
                                  "suggestedTemplate",
                                  (e.target as HTMLTextAreaElement).value
                                )
                              }
                            />
                            <Text fontSize="xs" color="fg.muted">
                              Suggested System (optional)
                            </Text>
                            <Textarea
                              size="sm"
                              h="20"
                              fontFamily="mono"
                              value={byId[p.id]?.suggestedSystem || ""}
                              onInput={(e) =>
                                setById(
                                  p.id,
                                  "suggestedSystem",
                                  (e.target as HTMLTextAreaElement).value
                                )
                              }
                            />
                            <HStack gap="2">
                              <Button
                                size="xs"
                                variant="outline"
                                colorPalette="gray"
                                disabled={!!byId[p.id]?.busyRevise}
                                onClick={() => onAcceptSuggestion(p, false)}
                              >
                                Accept → New Version
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                colorPalette="gray"
                                disabled={!!byId[p.id]?.busyRevise}
                                onClick={() => onAcceptSuggestion(p, true)}
                              >
                                Accept → New Version & Activate
                              </Button>
                            </HStack>
                          </Stack>
                        </Show>
                      </Stack>
                    </Box>
                  </Stack>
                )}
              </For>
            </Stack>
          </Suspense>
        </Stack>
      </Grid>
    </SimpleDialog>
  );

  return { open: openModal, view };
}

function DesignerLaunch(props: { onCreated?: () => Promise<void> | void }) {
  const { open, view } = usePromptDesignerModal(props.onCreated);
  const handleOpen = () => {
    open();
  };
  return (
    <Box mb="2">
      <Button
        size="xs"
        variant="outline"
        colorPalette="gray"
        onClick={handleOpen}
      >
        New via Q&A (LLM)
      </Button>
      {view}
    </Box>
  );
}
