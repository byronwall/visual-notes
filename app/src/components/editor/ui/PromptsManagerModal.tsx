import { For, Show, Suspense, createResource, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { apiFetch } from "~/utils/base-url";
import { usePromptDesignerModal } from "./PromptDesignerModal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Text } from "~/components/ui/text";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import * as Dialog from "~/components/ui/dialog";
import { css } from "styled-system/css";
import { XIcon } from "lucide-solid";

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
type PromptsResponse = { items: Prompt[] };

async function fetchPrompts(): Promise<Prompt[]> {
  const res = await apiFetch("/api/prompts");
  const data = (await res.json()) as PromptsResponse;
  return data.items || [];
}

export function usePromptsManagerModal() {
  const [open, setOpen] = createSignal(false);
  const [prompts, { refetch }] = createResource(fetchPrompts);

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
    console.log("[prompts-manager] inserted {{selection}}");
  };

  const onCreatePrompt = async () => {
    const task = newTask().trim();
    const template = newTemplate().trim();
    if (!task || !template) return;
    const res = await apiFetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        description: newDesc() || undefined,
        template,
        system: newSystem() || undefined,
        activate: true,
      }),
    });
    console.log("[prompts-manager] create status", res.status);
    await refetch();
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
    const res = await apiFetch(`/api/prompts/${id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template,
        system: system || undefined,
        activate: true,
      }),
    });
    console.log("[prompts-manager] add version status", res.status);
    await refetch();
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
    console.log("[prompts-manager] init edit for", p.id);
  };

  const onSaveNewVersion = async (p: Prompt, activate: boolean) => {
    const state = byId[p.id];
    const template = (state?.editTemplate || "").trim();
    const system = (state?.editSystem || "").trim();
    if (!template) return;
    setById(p.id, "busyEdit", true);
    try {
      const res = await apiFetch(`/api/prompts/${p.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          system: system || undefined,
          activate,
        }),
      });
      console.log("[prompts-manager] save new version status", res.status);
      await refetch();
    } finally {
      setById(p.id, "busyEdit", false);
    }
  };

  const onRevise = async (p: Prompt) => {
    const fb = (byId[p.id]?.feedback || "").trim();
    if (!fb) return;
    setById(p.id, "busyRevise", true);
    try {
      const res = await apiFetch(`/api/prompts/${p.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: fb }),
      });
      const data = (await res.json()) as {
        suggestion?: { template: string; system?: string | null };
        error?: string;
      };
      if (!data?.suggestion) {
        console.log("[prompts-manager] revise error", data?.error || "unknown");
        return;
      }
      setById(p.id, "suggestedTemplate", data.suggestion.template || "");
      setById(p.id, "suggestedSystem", data.suggestion.system || "");
      console.log("[prompts-manager] got suggestion for", p.id);
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
      const res = await apiFetch(`/api/prompts/${p.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          system: system || undefined,
          activate,
        }),
      });
      console.log("[prompts-manager] accept suggestion status", res.status);
      await refetch();
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
    <Dialog.Root
      open={open()}
      onOpenChange={(details: { open?: boolean }) => {
        if (details?.open === false) close();
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          class={css({
            maxW: "1100px",
            "--dialog-base-margin": "24px",
          })}
        >
          <Dialog.Header>
            <Dialog.Title>Manage Prompts</Dialog.Title>
          </Dialog.Header>

          <Dialog.CloseTrigger aria-label="Close dialog" onClick={close}>
            <XIcon />
          </Dialog.CloseTrigger>

          <Dialog.Body>
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
                void refetch();
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
                                  byId[p.id]?.editTemplate ||
                                  av().template ||
                                  ""
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
          </Dialog.Body>

          <Dialog.Footer>
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
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );

  return { open: openModal, view };
}

function DesignerLaunch(props: { onCreated?: () => Promise<void> | void }) {
  const { open, view } = usePromptDesignerModal(props.onCreated);
  const handleOpen = () => {
    console.log("[prompts-manager] open Q&A designer");
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
