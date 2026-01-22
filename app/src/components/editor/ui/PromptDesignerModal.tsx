import { For, Show, createSignal } from "solid-js";
import { useAction } from "@solidjs/router";
import { ModelSelect } from "~/components/ModelSelect";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Text } from "~/components/ui/text";
import { Box, Grid, HStack, Stack } from "styled-system/jsx";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { runPromptDesigner } from "~/services/ai/ai-prompt-designer.actions";
import { createPrompt } from "~/services/prompts/prompts.actions";

type Turn = { role: "user" | "assistant"; content: string };

type Proposal = {
  task?: string;
  description?: string;
  defaultModel?: string;
  defaultTemp?: number;
  template: string;
  system?: string;
};

export function usePromptDesignerModal(onCreated?: () => Promise<void> | void) {
  const [open, setOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const runDesigner = useAction(runPromptDesigner);
  const runCreatePrompt = useAction(createPrompt);
  const [transcript, setTranscript] = createSignal<Turn[]>([]);
  const [currentQuestion, setCurrentQuestion] = createSignal<string>("");
  const [currentSummary, setCurrentSummary] = createSignal<string>("");
  const [answer, setAnswer] = createSignal<string>("");
  const [proposal, setProposal] = createSignal<Proposal | null>(null);

  const reset = () => {
    setTranscript([]);
    setCurrentQuestion("");
    setCurrentSummary("");
    setAnswer("");
    setProposal(null);
  };

  const openModal = () => {
    reset();
    setOpen(true);
  };
  const close = () => setOpen(false);

  const askNext = async () => {
    setBusy(true);
    try {
      const data = await runDesigner({
        transcript: transcript(),
        mode: "qa",
      });
      if (
        "question" in data &&
        typeof data.question === "string" &&
        "summary" in data &&
        typeof data.summary === "string"
      ) {
        setTranscript((t) => [
          ...t,
          { role: "assistant", content: data.question },
        ]);
        setCurrentQuestion(data.question);
        setCurrentSummary(data.summary);
        console.log("[prompt-designer] question:", data.question);
        console.log("[prompt-designer] summary:", data.summary);
        return;
      }
      // Fallback to legacy: questions[]
      const legacy = data as { questions?: string[] };
      const qs = legacy?.questions || [];
      if (qs.length > 0) {
        setTranscript((t) => [...t, { role: "assistant", content: qs[0] }]);
        setCurrentQuestion(qs[0]);
        setCurrentSummary("Clarifying next step to define the prompt.");
        console.log("[prompt-designer] question (legacy):", qs[0]);
        return;
      }
      // If neither shape matches, inject a generic prompt
      const fallback =
        "Briefly describe your goal and the desired output format.";
      setTranscript((t) => [...t, { role: "assistant", content: fallback }]);
      setCurrentQuestion(fallback);
      setCurrentSummary("We need a brief description of your goal and output.");
    } catch (e) {
      console.log("[prompt-designer] error", e);
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (transcript().length > 0) return;
    await askNext();
  };
  const onSubmitAnswer = async () => {
    const a = answer().trim();
    if (!a) return;
    setTranscript((t) => [...t, { role: "user", content: a }]);
    setAnswer("");
    setCurrentQuestion("");
    await askNext();
  };
  const onGenerateNow = async () => {
    // If the user has a pending answer, include it in the transcript first
    const a = answer().trim();
    if (a) {
      setTranscript((t) => [...t, { role: "user", content: a }]);
      setAnswer("");
      setCurrentQuestion("");
    }
    setBusy(true);
    try {
      const data = await runDesigner({
        transcript: transcript(),
        mode: "generate",
      });
      if ("proposal" in data && data.proposal) {
        setProposal(data.proposal);
        console.log("[prompt-designer] received proposal");
        return;
      }
      console.log("[prompt-designer] no proposal returned");
    } catch (e) {
      console.log("[prompt-designer] generate error", e);
    } finally {
      setBusy(false);
    }
  };

  const [task, setTask] = createSignal<string>("");
  const [desc, setDesc] = createSignal<string>("");
  const [tmpl, setTmpl] = createSignal<string>("");
  const [sys, setSys] = createSignal<string>("");
  const [defModel, setDefModel] = createSignal<string>("gpt-4o-mini");
  const [defTemp, setDefTemp] = createSignal<number>(0.2);
  const [creating, setCreating] = createSignal(false);

  const initFromProposal = () => {
    const p = proposal();
    if (!p) return;
    setTask(p.task || "");
    setDesc(p.description || "");
    setTmpl(p.template || "");
    setSys(p.system || "");
    setDefModel(p.defaultModel || "gpt-4o-mini");
    setDefTemp(typeof p.defaultTemp === "number" ? p.defaultTemp : 0.2);
  };

  const onCreate = async () => {
    const finalTask = task().trim();
    const template = tmpl().trim();
    if (!finalTask || !template) return;
    setCreating(true);
    try {
      await runCreatePrompt({
        task: finalTask,
        description: desc().trim() || undefined,
        defaultModel: defModel().trim() || "gpt-4o-mini",
        defaultTemp: defTemp(),
        template,
        system: sys().trim() || undefined,
        activate: true,
      });
      console.log("[prompt-designer] create ok");
      if (onCreated) await onCreated();
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const view = (
    <SimpleDialog
      open={open()}
      onClose={close}
      title="New Prompt via Q&A"
      maxW="980px"
    >
      <Stack gap="3">
        <Show when={!proposal()}>
          <Stack gap="2">
            <Text fontSize="xs" color="fg.muted">
              I’ll ask 2–4 questions, then propose a complete prompt.
            </Text>
            <Stack
              gap="1"
              borderWidth="1px"
              borderColor="gray.outline.border"
              borderRadius="l2"
              p="2"
              maxH="14rem"
              overflow="auto"
            >
              <For each={transcript()}>
                {(t) => (
                  <Text fontSize="xs">
                    <Text as="span" fontWeight="medium">
                      {t.role === "assistant" ? "Assistant" : "You"}:
                    </Text>{" "}
                    <Text as="span">{t.content}</Text>
                  </Text>
                )}
              </For>
              <Show when={currentQuestion()}>
                {(q) => (
                  <Text fontSize="xs">
                    <Text as="span" fontWeight="medium">
                      Assistant:
                    </Text>{" "}
                    <Text as="span">{q()}</Text>
                  </Text>
                )}
              </Show>
            </Stack>
            <Show when={currentSummary()}>
              <Box
                borderWidth="1px"
                borderColor="gray.outline.border"
                borderRadius="l2"
                bg="gray.surface.bg"
                p="2"
              >
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Current summary
                </Text>
                <Text fontSize="sm">{currentSummary()}</Text>
              </Box>
            </Show>
            <HStack gap="2">
              <Input
                size="sm"
                flex="1"
                placeholder="Type your answer…"
                value={answer()}
                onInput={(e) => setAnswer((e.target as HTMLInputElement).value)}
              />
              <Button
                size="sm"
                variant="outline"
                colorPalette="gray"
                disabled={busy()}
                onClick={onSubmitAnswer}
              >
                Answer
              </Button>
              <Button
                size="sm"
                variant="outline"
                colorPalette="gray"
                disabled={busy()}
                onClick={onGenerateNow}
                title="Skip to proposal"
              >
                Generate
              </Button>
            </HStack>
            <Button
              size="sm"
              variant="outline"
              colorPalette="gray"
              disabled={busy() || transcript().length > 0}
              onClick={onStart}
            >
              Start Q&A
            </Button>
          </Stack>
        </Show>

        <Show when={proposal()}>
          {(p) => {
            initFromProposal();
            return (
              <Stack gap="2">
                <Text fontSize="xs" color="fg.muted">
                  Review the proposal and create the prompt.
                </Text>
                <Input
                  size="sm"
                  placeholder="task (unique)"
                  value={task()}
                  onInput={(e) => setTask((e.target as HTMLInputElement).value)}
                />
                <Input
                  size="sm"
                  placeholder="description"
                  value={desc()}
                  onInput={(e) => setDesc((e.target as HTMLInputElement).value)}
                />
                <Grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
                  <Stack gap="1">
                    <Text fontSize="xs" color="fg.muted">
                      Default model
                    </Text>
                    <ModelSelect
                      value={defModel()}
                      onChange={(v) => setDefModel(v)}
                    />
                  </Stack>
                  <Input
                    size="sm"
                    placeholder="default temp"
                    value={String(defTemp())}
                    onInput={(e) =>
                      setDefTemp(
                        Number((e.target as HTMLInputElement).value) || 0.2
                      )
                    }
                  />
                </Grid>
                <Textarea
                  size="sm"
                  h="40"
                  fontFamily="mono"
                  placeholder="template (Mustache)"
                  value={tmpl()}
                  onInput={(e) =>
                    setTmpl((e.target as HTMLTextAreaElement).value)
                  }
                />
                <Textarea
                  size="sm"
                  h="24"
                  fontFamily="mono"
                  placeholder="system (optional)"
                  value={sys()}
                  onInput={(e) =>
                    setSys((e.target as HTMLTextAreaElement).value)
                  }
                />
                <HStack justifyContent="flex-end">
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="gray"
                    disabled={creating()}
                    onClick={onCreate}
                  >
                    Create & Activate
                  </Button>
                </HStack>
              </Stack>
            );
          }}
        </Show>
      </Stack>
    </SimpleDialog>
  );

  return { open: openModal, view };
}
