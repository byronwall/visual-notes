import {
  For,
  Show,
  Suspense,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import SidePanel from "~/components/SidePanel";
import { apiFetch } from "~/utils/base-url";
import TiptapEditor from "~/components/TiptapEditor";
import { createStore } from "solid-js/store";
import type { Editor } from "@tiptap/core";

type ChatThreadStatus = "ACTIVE" | "LOADING" | "DONE";
type ChatMessageRole = "user" | "assistant";

type ThreadPreview = {
  id: string;
  title: string;
  status: ChatThreadStatus;
  noteId: string;
  lastMessageAt: string;
  updatedAt: string;
  preview: {
    id: string;
    role: ChatMessageRole;
    contentHtml: string;
    createdAt: string;
  } | null;
};
type ThreadsResponse = { items: ThreadPreview[] };

type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  contentHtml: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
};
type ThreadDetail = {
  id: string;
  title: string;
  status: ChatThreadStatus;
  noteId: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

async function fetchThreads(): Promise<ThreadPreview[]> {
  const res = await apiFetch("/api/ai/chat/threads");
  const data = (await res.json()) as ThreadsResponse;
  return data.items || [];
}

async function fetchThread(
  id: string | undefined
): Promise<ThreadDetail | undefined> {
  if (!id) return undefined;
  const res = await apiFetch(`/api/ai/chat/threads/${id}`);
  const data = (await res.json()) as { item?: ThreadDetail; error?: string };
  if (data?.error) return undefined;
  return data.item!;
}

export function useLLMSidebar() {
  const [open, setOpen] = createSignal(false);
  const [selectedId, setSelectedId] = createSignal<string | undefined>(
    undefined
  );
  const [threads, { refetch: refetchThreads }] = createResource(fetchThreads);
  const [thread, { refetch: refetchThread }] = createResource(
    selectedId,
    fetchThread
  );

  const openSidebar = (threadId?: string) => {
    if (threadId) setSelectedId(threadId);
    setOpen(true);
  };
  const closeSidebar = () => setOpen(false);

  const createThread = async (noteId: string, title?: string) => {
    const res = await apiFetch("/api/ai/chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, title }),
    });
    const data = (await res.json()) as {
      item?: { id: string };
      error?: string;
    };
    if (data?.item?.id) {
      await refetchThreads();
      setSelectedId(data.item.id);
      await refetchThread();
      setOpen(true);
    }
  };

  const sendMessage = async (text: string) => {
    const id = selectedId();
    if (!id || !text.trim()) return;
    // Optimistic: mark loading state by refetching thread after POST returns
    const res = await apiFetch(`/api/ai/chat/threads/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const _ = await res.json();
    await Promise.all([refetchThread(), refetchThreads()]);
  };

  const saveAssistantEdit = async (msgId: string, contentHtml: string) => {
    const res = await apiFetch(`/api/ai/chat/messages/${msgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentHtml }),
    });
    const _ = await res.json();
    await refetchThread();
  };

  const deleteMessage = async (msgId: string) => {
    console.log("[LLMSidebar] Deleting message:", msgId);
    const res = await apiFetch(`/api/ai/chat/messages/${msgId}`, {
      method: "DELETE",
    });
    const _ = await res.json();
    await Promise.all([refetchThread(), refetchThreads()]);
  };

  const view = (
    <LLMSidebarView
      open={open()}
      onClose={() => setOpen(false)}
      threads={threads() || []}
      selectedId={selectedId()}
      onSelect={(id) => setSelectedId(id)}
      thread={thread()}
      onRefresh={() => {
        void refetchThreads();
        void refetchThread();
      }}
      onCreateThread={createThread}
      onSend={sendMessage}
      onSaveEdit={saveAssistantEdit}
      onDeleteMessage={deleteMessage}
    />
  );

  return { open: openSidebar, close: closeSidebar, view };
}

function LLMSidebarView(props: {
  open: boolean;
  onClose: () => void;
  threads: ThreadPreview[];
  selectedId?: string;
  onSelect: (id: string) => void;
  thread?: ThreadDetail;
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
    console.log("[LLMSidebar] Sending message");
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
      console.log("[LLMSidebar] Send failed", e);
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
    const th = props.thread;
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
    console.log("[LLMSidebar] Initialized message state for thread:", th.id);
  });

  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      ariaLabel="LLM Chat Sidebar"
      class="w-[min(96vw,1000px)]"
    >
      <div class="flex h-full">
        {/* Left column: threads list */}
        <div class="w-64 shrink-0 border-r border-gray-200 bg-white">
          <div class="p-3 border-b flex items-center justify-between">
            <div class="font-semibold">Chats</div>
            <button
              class="text-xs text-blue-600 hover:underline"
              onClick={() => props.onRefresh()}
            >
              Refresh
            </button>
          </div>
          <div class="p-3 space-y-2">
            <div class="space-y-2">
              <input
                class="w-full border rounded px-2 py-1"
                placeholder="Note ID…"
                value={noteInput()}
                onInput={(e) =>
                  setNoteInput((e.currentTarget as HTMLInputElement).value)
                }
              />
              <input
                class="w-full border rounded px-2 py-1"
                placeholder="Title (optional)"
                value={titleInput()}
                onInput={(e) =>
                  setTitleInput((e.currentTarget as HTMLInputElement).value)
                }
              />
              <button class="w-full cta" onClick={handleCreate}>
                New Chat
              </button>
            </div>
          </div>
          <div class="overflow-y-auto max-h-[calc(100%-160px)]">
            <Suspense
              fallback={<div class="p-3 text-sm text-gray-500">Loading…</div>}
            >
              <For each={props.threads}>
                {(t) => (
                  <button
                    class={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                      props.selectedId === t.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => props.onSelect(t.id)}
                  >
                    <div class="flex items-center gap-2">
                      <Show when={t.status === "LOADING"}>
                        <span class="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      </Show>
                      <div class="font-medium truncate">{t.title}</div>
                    </div>
                    <a
                      href={`/docs/${t.noteId}`}
                      class="text-xs text-blue-600 hover:underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t.noteId}
                    </a>
                    <Show when={t.preview}>
                      {(p) => (
                        <div
                          class="mt-1 text-xs text-gray-600 line-clamp-2"
                          innerHTML={p().contentHtml}
                        />
                      )}
                    </Show>
                  </button>
                )}
              </For>
            </Suspense>
          </div>
        </div>

        {/* Right column: thread view */}
        <div class="flex-1 flex flex-col bg-white">
          <div class="p-3 border-b">
            <Show
              when={props.thread}
              fallback={<div class="text-sm text-gray-500">Select a chat</div>}
            >
              {(th) => (
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-semibold">{th().title}</div>
                    <div class="text-xs text-gray-500">Note: {th().noteId}</div>
                  </div>
                  <div class="text-xs text-gray-500">
                    <Show when={th().status === "LOADING"}>Loading…</Show>
                    <Show when={isSending()}>
                      <span class="inline-flex items-center gap-1 ml-2 text-amber-600">
                        <span class="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        Sending…
                      </span>
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <Suspense
              fallback={
                <div class="text-sm text-gray-500">Loading messages…</div>
              }
            >
              <Show when={props.thread}>
                {(th) => (
                  <For each={th().messages}>
                    {(m) => (
                      <div class="border rounded p-3">
                        <div class="text-xs text-gray-500 mb-2">
                          {m.role === "user" ? "You" : "Assistant"}
                        </div>
                        <TiptapEditor
                          initialHTML={m.contentHtml}
                          class="w-full"
                          showToolbar={false}
                          onEditor={(ed: Editor) => {
                            console.log(
                              "[LLMSidebar] Editor ready for message:",
                              m.id
                            );
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
                            // Initialize current state immediately
                            onUpdate();
                            onCleanup(() => {
                              ed.off("update", onUpdate);
                            });
                          }}
                        />
                        <div class="mt-2 flex items-center justify-between">
                          <div>
                            <Show when={messageState[m.id]?.dirty}>
                              <button
                                class="text-xs text-blue-600 hover:underline"
                                onClick={async () => {
                                  const html =
                                    messageState[m.id]?.currentHtml ??
                                    m.contentHtml;
                                  console.log(
                                    "[LLMSidebar] Save clicked for message:",
                                    m.id
                                  );
                                  await props.onSaveEdit(m.id, html);
                                }}
                              >
                                Save
                              </button>
                            </Show>
                          </div>
                          <div>
                            <button
                              class="text-xs text-red-600 hover:underline"
                              onClick={async () => {
                                await props.onDeleteMessage(m.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                )}
              </Show>
            </Suspense>
          </div>
          <div class="border-t p-3">
            <div class="flex items-end gap-2">
              <textarea
                class="flex-1 border rounded px-2 py-2 min-h-[64px]"
                placeholder="Type a message…"
                value={draft()}
                onInput={(e) =>
                  setDraft((e.currentTarget as HTMLTextAreaElement).value)
                }
              />
              <div class="flex flex-col gap-2">
                <button
                  class="cta"
                  onClick={handleSend}
                  disabled={isSending() || !draft().trim()}
                  aria-busy={isSending()}
                >
                  <Show when={sendPhase() === "sending"}>
                    <span class="inline-flex items-center gap-2">
                      <span class="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      Sending…
                    </span>
                  </Show>
                  <Show when={sendPhase() === "sent"}>Sent</Show>
                  <Show when={sendPhase() === "error"}>Retry</Show>
                  <Show when={sendPhase() === "idle"}>Send</Show>
                </button>
                <button class="secondary" onClick={props.onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
