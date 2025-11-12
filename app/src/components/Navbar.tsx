import type { VoidComponent } from "solid-js";
import { createSignal, onMount } from "solid-js";
import { useMagicAuth } from "~/hooks/useMagicAuth";
import { useLLMSidebar } from "~/components/ai/LLMSidebar";
import { onLLMSidebarEvent } from "~/components/ai/LLMSidebarBus";

const Navbar: VoidComponent = () => {
  const { authed, logout } = useMagicAuth();
  const { open: openLLM, view: llmSidebarView } = useLLMSidebar();
  const handleLogout = async () => {
    await logout();
  };
  onMount(() => {
    const off = onLLMSidebarEvent((e) => {
      if (e.type === "open") {
        openLLM(e.threadId);
      }
    });
    return () => {
      off();
    };
  });

  return (
    <nav class="w-full border-b border-gray-200 bg-white">
      <div class="container mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a
            href="/"
            class="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <img
              src="/favicon-32x32.png"
              alt=""
              width="24"
              height="24"
              class="rounded"
            />
            <span>Visual Notes</span>
          </a>
          <div class="flex items-center gap-4 text-sm">
            <a href="/docs" class="hover:underline">
              Notes
            </a>
            <a href="/docs/new" class="hover:underline">
              New Note
            </a>

            <a href="/embeddings" class="hover:underline">
              Embeddings
            </a>
            <a href="/umap" class="hover:underline">
              UMAP
            </a>
            <a href="/ai" class="hover:underline">
              AI
            </a>
            <button class="hover:underline" onClick={() => openLLM()}>
              Chat
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          {authed() ? (
            <button class="cta" onClick={handleLogout}>
              Sign out
            </button>
          ) : (
            <a class="cta" href="/login">
              Sign in
            </a>
          )}
        </div>
      </div>
      {llmSidebarView}
    </nav>
  );
};

export default Navbar;
