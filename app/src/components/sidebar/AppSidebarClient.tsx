import type { JSX } from "solid-js";
import { Show, createSignal, onMount } from "solid-js";
import { useMagicAuth } from "~/hooks/useMagicAuth";
import { useLLMSidebar } from "~/components/ai/LLMSidebar";
import { onLLMSidebarEvent } from "~/components/ai/LLMSidebarBus";
import { CommandKMenu } from "~/components/CommandKMenu";
import { NewNoteModal } from "~/components/NewNoteModal";
import { AppSidebarDesktop } from "./AppSidebarDesktop";
import { AppSidebarMobile } from "./AppSidebarMobile";
import { Box } from "styled-system/jsx";

const COLLAPSED_WIDTH = "100px";
const EXPANDED_WIDTH = "300px";

type AppSidebarClientProps = {
  children: JSX.Element;
};

export const AppSidebarClient = (props: AppSidebarClientProps) => {
  const { authed, logout } = useMagicAuth();
  const {
    open: openLLM,
    view: llmSidebarView,
    hasUnreadAny,
    hasLoadingAny,
  } = useLLMSidebar();

  const [collapsed, setCollapsed] = createSignal(false);
  const [cmdkOpen, setCmdkOpen] = createSignal(false);
  const [newNoteOpen, setNewNoteOpen] = createSignal(false);
  const [newNoteInitialTitle, setNewNoteInitialTitle] = createSignal<
    string | undefined
  >(undefined);
  const [mobileOpen, setMobileOpen] = createSignal(false);
  const [isMobileView, setIsMobileView] = createSignal(false);

  const isExpanded = () => !collapsed();

  const handleChatOpen = () => {
    openLLM();
  };

  const handleNewNoteOpen = () => {
    setNewNoteInitialTitle(undefined);
    setNewNoteOpen(true);
  };

  const handleSearchOpen = () => {
    setCmdkOpen(true);
  };

  const handleNewNoteOpenChange = (open: boolean) => {
    setNewNoteOpen(open);
    if (open === false) setNewNoteInitialTitle(undefined);
  };

  const handleCreateNewNoteFromCmdk = (initialTitle: string | undefined) => {
    setNewNoteInitialTitle(initialTitle);
    setNewNoteOpen(true);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleCollapseToggle = () => {
    setCollapsed((prev) => !prev);
  };

  onMount(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileView(media.matches);
    syncViewport();

    const off = onLLMSidebarEvent((e) => {
      if (e.type === "open") {
        openLLM(e.threadId);
      }
    });
    const onWindowKeyDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.metaKey !== true) return;
      if (ev.altKey || ev.ctrlKey) return;
      if (ev.key.toLowerCase() !== "k") return;
      ev.preventDefault();
      setCmdkOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onWindowKeyDown);
    media.addEventListener("change", syncViewport);
    return () => {
      off();
      window.removeEventListener("keydown", onWindowKeyDown);
      media.removeEventListener("change", syncViewport);
    };
  });

  return (
    <>
      <Box minH="100vh" bg="bg.default">
        <Show
          when={isMobileView()}
          fallback={
            <AppSidebarDesktop
              expanded={isExpanded()}
              collapsedWidth={COLLAPSED_WIDTH}
              expandedWidth={EXPANDED_WIDTH}
              onSidebarMouseEnter={() => {}}
              onSidebarMouseLeave={() => {}}
              onToggleCollapse={handleCollapseToggle}
              onClose={() => setCollapsed(true)}
              onChatOpen={handleChatOpen}
              onNewNoteOpen={handleNewNoteOpen}
              onSearchOpen={handleSearchOpen}
              onLogout={handleLogout}
              hasUnreadAny={hasUnreadAny}
              hasLoadingAny={hasLoadingAny}
              authed={authed}
            >
              {props.children}
            </AppSidebarDesktop>
          }
        >
          <AppSidebarMobile
            open={mobileOpen()}
            onOpenChange={setMobileOpen}
            onToggleCollapse={handleCollapseToggle}
            onChatOpen={handleChatOpen}
            onNewNoteOpen={handleNewNoteOpen}
            onSearchOpen={handleSearchOpen}
            onLogout={handleLogout}
            hasUnreadAny={hasUnreadAny}
            hasLoadingAny={hasLoadingAny}
            authed={authed}
          >
            {props.children}
          </AppSidebarMobile>
        </Show>
      </Box>

      {llmSidebarView}
      <CommandKMenu
        open={cmdkOpen()}
        onOpenChange={setCmdkOpen}
        onCreateNewNote={handleCreateNewNoteFromCmdk}
      />
      <NewNoteModal
        open={newNoteOpen()}
        onOpenChange={handleNewNoteOpenChange}
        initialTitle={newNoteInitialTitle()}
      />
    </>
  );
};
