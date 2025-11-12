import { For, Show, Suspense, createResource, createSignal } from "solid-js";
import SidePanel from "~/components/SidePanel";
import { apiFetch } from "~/utils/base-url";

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
}) {
  const [noteInput, setNoteInput] = createSignal("");
  const [titleInput, setTitleInput] = createSignal("");
  const [draft, setDraft] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | undefined>(undefined);
  const [editingHtml, setEditingHtml] = createSignal("");

  const handleCreate = async () => {
    const nid = noteInput().trim();
    if (!nid) return;
    await props.onCreateThread(nid, titleInput().trim() || undefined);
    setNoteInput("");
    setTitleInput("");
  };
  const handleSend = async () => {
    const txt = draft().trim();
    if (!txt) return;
    await props.onSend(txt);
    setDraft("");
  };

  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      ariaLabel="LLM Chat Sidebar"
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
                        <div class="text-xs text-gray-500 mb-1">
                          {m.role === "user" ? "You" : "Assistant"}
                        </div>
                        <Show
                          when={editingId() === m.id}
                          fallback={<div innerHTML={m.contentHtml} />}
                        >
                          <textarea
                            class="w-full border rounded px-2 py-1 min-h-[120px]"
                            value={editingHtml()}
                            onInput={(e) =>
                              setEditingHtml(
                                (e.currentTarget as HTMLTextAreaElement).value
                              )
                            }
                          />
                        </Show>
                        <Show when={m.role === "assistant"}>
                          <div class="mt-2 flex gap-2">
                            <Show when={editingId() !== m.id}>
                              <button
                                class="text-xs text-blue-600 hover:underline"
                                onClick={() => {
                                  setEditingId(m.id);
                                  setEditingHtml(m.contentHtml);
                                }}
                              >
                                Edit
                              </button>
                            </Show>
                            <Show when={editingId() === m.id}>
                              <div class="flex items-center gap-2">
                                <button
                                  class="text-xs text-blue-600 hover:underline"
                                  onClick={async () => {
                                    await props.onSaveEdit(m.id, editingHtml());
                                    setEditingId(undefined);
                                    setEditingHtml("");
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  class="text-xs text-gray-600 hover:underline"
                                  onClick={() => {
                                    setEditingId(undefined);
                                    setEditingHtml("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </Show>
                          </div>
                        </Show>
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
                <button class="cta" onClick={handleSend}>
                  Send
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
