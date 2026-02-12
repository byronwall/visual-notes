import {
  For,
  Show,
  Suspense,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";
import type { Accessor } from "solid-js";
import { createAsync, revalidate, useAction } from "@solidjs/router";
import TiptapEditor from "~/components/TiptapEditor";
import { createStore } from "solid-js/store";
import type { Editor } from "@tiptap/core";
import { useToasts } from "~/components/Toast";
import { isServer } from "solid-js/web";
import { css } from "styled-system/css";
import { Box, Flex, HStack, Spacer, Stack } from "styled-system/jsx";
import { XIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import * as Drawer from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import * as ScrollArea from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import {
  fetchChatThread,
  fetchChatThreads,
  type ChatThreadDetail,
  type ChatThreadPreview,
  type ChatMessageRole,
} from "~/services/ai/ai-chat.queries";
import {
  createChatThread,
  deleteChatMessage,
  sendChatMessage,
  updateChatMessage,
  updateChatThread,
} from "~/services/ai/ai-chat.actions";

type ChatThreadStatus = "ACTIVE" | "LOADING" | "DONE";

type ThreadPreview = ChatThreadPreview;

type ThreadDetail = ChatThreadDetail;

export function useLLMSidebar() {
  const [open, setOpen] = createSignal(false);
  const [selectedId, setSelectedId] = createSignal<string | undefined>(
    undefined
  );
  const threads = createAsync(() => fetchChatThreads());
  const thread = createAsync(() => {
    const id = selectedId();
    if (!id) return Promise.resolve<ThreadDetail | null>(null);
    return fetchChatThread(id) as Promise<ThreadDetail | null>;
  });
  const runCreateThread = useAction(createChatThread);
  const runUpdateThread = useAction(updateChatThread);
  const runSendMessage = useAction(sendChatMessage);
  const runUpdateMessage = useAction(updateChatMessage);
  const runDeleteMessage = useAction(deleteChatMessage);
  const { show: showToast } = useToasts();
  const [lastKnown, setLastKnown] = createStore<
    Record<string, { status: ChatThreadStatus; lastMessageAt: string }>
  >({});

  const refreshThreads = async () => {
    await revalidate(fetchChatThreads.key);
  };

  const refreshThread = async () => {
    const id = selectedId();
    if (!id) return;
    await revalidate(fetchChatThread.keyFor(id));
  };

  const hasUnreadAny = () => {
    const list = threads();
    if (!list) return false;
    return list.some((t) => t.hasUnread);
  };
  const hasLoadingAny = () => {
    const list = threads();
    if (!list) return false;
    return list.some((t) => t.status === "LOADING");
  };

  // Adaptive polling with backoff:
  // - Start at 10s
  // - If no pending (LOADING) chats, back off by +10s up to 60s
  // - If a new request comes in, reset to 10s
  let pollDelayMs = 10000;
  let pollTimer: number | undefined;
  let destroyed = false;
  const maxDelayMs = 60000;
  const stepMs = 10000;

  const schedulePoll = () => {
    if (isServer) return;
    if (destroyed) return;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = window.setTimeout(runPoll, pollDelayMs);
  };

  function resetPolling() {
    pollDelayMs = 10000;
    schedulePoll();
  }

  const openSidebar = (threadId?: string) => {
    if (threadId) setSelectedId(threadId);
    setOpen(true);
    // Opening sidebar often follows a new request; reset polling
    resetPolling();
  };
  const closeSidebar = () => setOpen(false);

  const createThread = async (noteId: string, title?: string) => {
    const data = await runCreateThread({ noteId, title });
    if (data?.item?.id) {
      await refreshThreads();
      setSelectedId(data.item.id);
      await refreshThread();
      setOpen(true);
      resetPolling();
    }
  };

  const runPoll = async () => {
    try {
      const list = await fetchChatThreads();
      for (const t of list) {
        const prev = lastKnown[t.id];
        if (!prev) {
          setLastKnown(t.id, {
            status: t.status,
            lastMessageAt: t.lastMessageAt,
          });
          continue;
        }
        const statusChanged = prev.status !== t.status;
        const lastChanged = prev.lastMessageAt !== t.lastMessageAt;
        setLastKnown(t.id, {
          status: t.status,
          lastMessageAt: t.lastMessageAt,
        });
        if (
          (statusChanged || lastChanged) &&
          t.status === "DONE" &&
          t.hasUnread &&
          !open()
        ) {
          showToast({
            title: "Chat updated",
            message: t.title,
            onClick: () => openSidebar(t.id),
          });
        }
      }
      await refreshThreads();
      if (selectedId()) {
        await refreshThread();
      }
      const hasPending = list.some((t) => t.status === "LOADING");
      if (hasPending) {
        pollDelayMs = 10000;
      } else {
        pollDelayMs = Math.min(pollDelayMs + stepMs, maxDelayMs);
      }
    } catch (e) {
      // On error, try again after current delay without changing it
    } finally {
      schedulePoll();
    }
  };
  schedulePoll();
  onCleanup(() => {
    destroyed = true;
    if (pollTimer) clearTimeout(pollTimer);
  });

  // Mark unread as read when viewing an open thread that has unread
  createEffect(() => {
    const th = thread();
    if (!th) return;
    if (open() && th.hasUnread) {
      void runUpdateThread({ id: th.id, hasUnread: false }).then(() => {
        void refreshThreads();
        void refreshThread();
      });
    }
  });

  const sendMessage = async (text: string) => {
    const id = selectedId();
    if (!id || !text.trim()) return;
    // Optimistic: mark loading state by refetching thread after POST returns
    await runSendMessage({ threadId: id, text });
    await Promise.all([refreshThread(), refreshThreads()]);
    // Reset polling on new message
    resetPolling();
  };

  const saveAssistantEdit = async (msgId: string, contentHtml: string) => {
    await runUpdateMessage({ id: msgId, contentHtml });
    await refreshThread();
  };

  const deleteMessage = async (msgId: string) => {
    await runDeleteMessage({ id: msgId });
    await Promise.all([refreshThread(), refreshThreads()]);
  };

  // Pass accessors to keep the view reactive without remounting on polls
  const view = (
    <Suspense
      fallback={
        <Box p="4">
          <HStack gap="2" alignItems="center">
            <Spinner size="sm" color="fg.muted" />
            <Text fontSize="sm" color="fg.muted">
              Loading…
            </Text>
          </HStack>
        </Box>
      }
    >
      <LLMSidebarView
        open={open}
        onClose={() => setOpen(false)}
        threads={() => threads() || []}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
        thread={() => thread() || undefined}
        onRefresh={() => {
          void refreshThreads();
          void refreshThread();
        }}
        onCreateThread={createThread}
        onSend={sendMessage}
        onSaveEdit={saveAssistantEdit}
        onDeleteMessage={deleteMessage}
      />
    </Suspense>
  );

  return {
    open: openSidebar,
    close: closeSidebar,
    view,
    hasUnreadAny,
    hasLoadingAny,
  };
}

function LLMSidebarView(props: {
  open: Accessor<boolean>;
  onClose: () => void;
  threads: Accessor<ThreadPreview[]>;
  selectedId: Accessor<string | undefined>;
  onSelect: (id: string) => void;
  thread: Accessor<ThreadDetail | undefined>;
  onRefresh: () => void;
  onCreateThread: (noteId: string, title?: string) => Promise<void>;
  onSend: (text: string) => Promise<void>;
  onSaveEdit: (msgId: string, contentHtml: string) => Promise<void>;
  onDeleteMessage: (msgId: string) => Promise<void>;
}) {
  const [noteInput, setNoteInput] = createSignal("");
  const [titleInput, setTitleInput] = createSignal("");
  const [draft, setDraft] = createSignal("");
  const [isSending, setIsSending] = createSignal(false);
  const [sendPhase, setSendPhase] = createSignal<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [messageState, setMessageState] = createStore<
    Record<
      string,
      {
        initialHtml: string;
        currentHtml: string;
        dirty: boolean;
      }
    >
  >({});

  const handleCreate = async () => {
    const nid = noteInput().trim();
    if (!nid) return;
    await props.onCreateThread(nid, titleInput().trim() || undefined);
    setNoteInput("");
    setTitleInput("");
  };
  const handleSend = async () => {
    const txt = draft().trim();
    if (!txt || isSending()) return;
    setIsSending(true);
    setSendPhase("sending");
    try {
      await props.onSend(txt);
      setDraft("");
      setSendPhase("sent");
      setTimeout(() => {
        setSendPhase("idle");
      }, 1200);
    } catch (e) {
      setSendPhase("error");
      setTimeout(() => {
        setSendPhase("idle");
      }, 2000);
    } finally {
      setIsSending(false);
    }
  };

  // Reset message state when switching threads
  createEffect(() => {
    const th = props.thread();
    if (!th) return;
    const next: Record<
      string,
      { initialHtml: string; currentHtml: string; dirty: boolean }
    > = {};
    for (const m of th.messages) {
      next[m.id] = {
        initialHtml: m.contentHtml,
        currentHtml: m.contentHtml,
        dirty: false,
      };
    }
    setMessageState(next);
  });

  const handleDrawerOpenChange = (details: { open?: boolean }) => {
    if (details?.open === false) {
      props.onClose();
    }
  };

  const handleNoteInput = (e: Event) => {
    setNoteInput((e.currentTarget as HTMLInputElement).value);
  };

  const handleTitleInput = (e: Event) => {
    setTitleInput((e.currentTarget as HTMLInputElement).value);
  };

  const handleDraftInput = (e: Event) => {
    setDraft((e.currentTarget as HTMLTextAreaElement).value);
  };

  const threadPreviewClass = css({
    mt: "1",
    fontSize: "xs",
    color: "fg.muted",
    lineClamp: "2",
  });

  const handleSaveMessage = async (msgId: string, fallbackHtml: string) => {
    const html = messageState[msgId]?.currentHtml ?? fallbackHtml;
    await props.onSaveEdit(msgId, html);
  };

  const handleDeleteMessage = async (msgId: string) => {
    await props.onDeleteMessage(msgId);
  };

  const sendButtonLabel = () => {
    const phase = sendPhase();
    if (phase === "sent") return "Sent";
    if (phase === "error") return "Retry";
    return "Send";
  };

  return (
    <Drawer.Root
      open={props.open()}
      onOpenChange={handleDrawerOpenChange}
      placement="end"
      size="full"
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content w="96vw" maxW="1000px">
          <Drawer.CloseTrigger aria-label="Close sidebar">
            <XIcon />
          </Drawer.CloseTrigger>

          <Flex h="100dvh" minH="0">
            {/* Left column: threads list */}
            <Box
              w="16rem"
              flexShrink="0"
              borderRightWidth="1px"
              borderColor="border"
              bg="bg.default"
              display="flex"
              flexDirection="column"
              minH="0"
            >
              <HStack
                px="3"
                py="3"
                borderBottomWidth="1px"
                borderColor="border"
                gap="2"
                alignItems="center"
              >
                <Text fontWeight="semibold">Chats</Text>
                <Spacer />
                <Button
                  size="xs"
                  variant="plain"
                  colorPalette="blue"
                  onClick={props.onRefresh}
                >
                  Refresh
                </Button>
              </HStack>

              <Stack
                p="3"
                gap="2"
                borderBottomWidth="1px"
                borderColor="border"
              >
                <Input
                  size="sm"
                  placeholder="Note ID…"
                  value={noteInput()}
                  onInput={handleNoteInput}
                />
                <Input
                  size="sm"
                  placeholder="Title (optional)"
                  value={titleInput()}
                  onInput={handleTitleInput}
                />
                <Button w="full" size="sm" variant="solid" colorPalette="green" onClick={handleCreate}>
                  New Chat
                </Button>
              </Stack>

              <Box flex="1" minH="0">
                <ScrollArea.Root h="full">
                  <ScrollArea.Viewport>
                    <ScrollArea.Content>
                      <Suspense
                        fallback={
                          <Box p="3">
                            <HStack gap="2" alignItems="center">
                              <Spinner size="sm" color="fg.muted" />
                              <Text fontSize="sm" color="fg.muted">
                                Loading…
                              </Text>
                            </HStack>
                          </Box>
                        }
                      >
                        <Stack gap="1" p="1">
                          <For each={props.threads()}>
                            {(t) => {
                              const selected = () => props.selectedId() === t.id;
                              return (
                                <Button
                                  size="sm"
                                  variant={selected() ? "subtle" : "plain"}
                                  colorPalette={selected() ? "blue" : "gray"}
                                  w="full"
                                  h="auto"
                                  py="2"
                                  px="3"
                                  display="flex"
                                  flexDirection="column"
                                  alignItems="stretch"
                                  justifyContent="flex-start"
                                  textAlign="left"
                                  onClick={() => props.onSelect(t.id)}
                                >
                                  <HStack gap="2" alignItems="center">
                                    <Show when={t.status === "LOADING"}>
                                      <Spinner size="xs" color="amber.11" />
                                    </Show>
                                    <Show when={t.hasUnread}>
                                      <Box
                                        boxSize="2"
                                        borderRadius="full"
                                        bg="blue.9"
                                      />
                                    </Show>
                                    <Text fontWeight="medium" truncate>
                                      {t.title}
                                    </Text>
                                  </HStack>

                                  <Link
                                    href={`/docs/${t.noteId}`}
                                    fontSize="xs"
                                    color="blue.11"
                                    truncate
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {t.noteId}
                                  </Link>

                                  <Show when={t.preview}>
                                    {(p) => (
                                      <Box
                                        class={threadPreviewClass}
                                        innerHTML={p().contentHtml}
                                      />
                                    )}
                                  </Show>
                                </Button>
                              );
                            }}
                          </For>
                        </Stack>
                      </Suspense>
                    </ScrollArea.Content>
                  </ScrollArea.Viewport>
                  <ScrollArea.Scrollbar orientation="vertical">
                    <ScrollArea.Thumb />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>
              </Box>
            </Box>

            {/* Right column: thread view */}
            <Flex flex="1" minH="0" flexDirection="column" bg="bg.default">
              <Box px="4" py="3" borderBottomWidth="1px" borderColor="border">
                <Show
                  when={props.thread()}
                  fallback={
                    <Text fontSize="sm" color="fg.muted">
                      Select a chat
                    </Text>
                  }
                >
                  {(th) => (
                    <Flex align="center" justify="space-between" gap="4">
                      <Box minW="0">
                        <Text fontWeight="semibold" truncate>
                          {th().title}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" truncate>
                          Note: {th().noteId}
                        </Text>
                      </Box>
                      <HStack gap="2" alignItems="center" color="fg.muted">
                        <Show when={th().status === "LOADING"}>
                          <HStack gap="2" alignItems="center">
                            <Spinner size="xs" color="amber.11" />
                            <Text fontSize="xs">Loading…</Text>
                          </HStack>
                        </Show>
                        <Show when={isSending()}>
                          <HStack gap="2" alignItems="center" color="amber.11">
                            <Spinner size="xs" color="amber.11" />
                            <Text fontSize="xs">Sending…</Text>
                          </HStack>
                        </Show>
                      </HStack>
                    </Flex>
                  )}
                </Show>
              </Box>

              <Box flex="1" minH="0">
                <ScrollArea.Root h="full">
                  <ScrollArea.Viewport>
                    <ScrollArea.Content>
                      <Box p="4">
                        <Suspense
                          fallback={
                            <HStack gap="2" alignItems="center">
                              <Spinner size="sm" color="fg.muted" />
                              <Text fontSize="sm" color="fg.muted">
                                Loading messages…
                              </Text>
                            </HStack>
                          }
                        >
                          <Show when={props.thread()}>
                            {(th) => (
                              <Stack gap="4">
                                <For each={th().messages}>
                                  {(m) => (
                                    <Box
                                      borderWidth="1px"
                                      borderColor="gray.outline.border"
                                      borderRadius="l2"
                                      p="3"
                                      bg="bg.default"
                                    >
                                      <Text fontSize="xs" color="fg.muted" mb="2">
                                        {m.role === "user" ? "You" : "Assistant"}
                                      </Text>

                                      <TiptapEditor
                                        initialHTML={m.contentHtml}
                                        showToolbar={false}
                                        onEditor={(ed: Editor) => {
                                          const onUpdate = () => {
                                            const html = ed.getHTML();
                                            const state = messageState[m.id];
                                            const isDirty = state
                                              ? html !== state.initialHtml
                                              : html !== m.contentHtml;
                                            setMessageState(m.id, {
                                              initialHtml:
                                                state?.initialHtml ?? m.contentHtml,
                                              currentHtml: html,
                                              dirty: isDirty,
                                            });
                                          };
                                          ed.on("update", onUpdate);
                                          onUpdate();
                                          onCleanup(() => {
                                            ed.off("update", onUpdate);
                                          });
                                        }}
                                      />

                                      <HStack
                                        mt="2"
                                        alignItems="center"
                                        justifyContent="space-between"
                                      >
                                        <Show when={messageState[m.id]?.dirty}>
                                          <Button
                                            size="xs"
                                            variant="plain"
                                            colorPalette="blue"
                                            onClick={() => void handleSaveMessage(m.id, m.contentHtml)}
                                          >
                                            Save
                                          </Button>
                                        </Show>
                                        <Button
                                          size="xs"
                                          variant="plain"
                                          colorPalette="red"
                                          onClick={() => void handleDeleteMessage(m.id)}
                                        >
                                          Delete
                                        </Button>
                                      </HStack>
                                    </Box>
                                  )}
                                </For>
                              </Stack>
                            )}
                          </Show>
                        </Suspense>
                      </Box>
                    </ScrollArea.Content>
                  </ScrollArea.Viewport>
                  <ScrollArea.Scrollbar orientation="vertical">
                    <ScrollArea.Thumb />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>
              </Box>

              <Box borderTopWidth="1px" borderColor="border" p="3">
                <HStack gap="2" alignItems="flex-end">
                  <Textarea
                    flex="1"
                    minH="64px"
                    placeholder="Type a message…"
                    value={draft()}
                    onInput={handleDraftInput}
                  />
                  <Stack gap="2" w="10rem">
                    <Button
                      variant="solid"
                      colorPalette="blue"
                      onClick={handleSend}
                      disabled={isSending() || !draft().trim()}
                      loading={sendPhase() === "sending"}
                      loadingText={<Text fontSize="sm">Sending…</Text>}
                      aria-busy={isSending()}
                    >
                      {sendButtonLabel()}
                    </Button>
                    <Button
                      variant="outline"
                      colorPalette="gray"
                      onClick={props.onClose}
                    >
                      Close
                    </Button>
                  </Stack>
                </HStack>
              </Box>
            </Flex>
          </Flex>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
