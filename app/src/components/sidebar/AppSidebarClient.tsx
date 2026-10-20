import type { JSX } from "solid-js";
import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { useLocation } from "@solidjs/router";
import { useMagicAuth } from "~/hooks/useMagicAuth";
import { useLLMSidebar } from "~/components/ai/LLMSidebar";
import { onLLMSidebarEvent } from "~/components/ai/LLMSidebarBus";
import { CommandKMenu } from "~/components/CommandKMenu";
import { NewNoteModal } from "~/components/NewNoteModal";
import { ConsoleLogsPanel } from "~/components/ConsoleLogsPanel";
import { AppSidebarDesktop } from "./AppSidebarDesktop";
import { AppSidebarMobile } from "./AppSidebarMobile";
import { Box } from "styled-system/jsx";
import {
  BotMessageSquareIcon,
  PanelLeftIcon,
  SunMoonIcon,
  TerminalIcon,
} from "lucide-solid";
import type { PaletteAction } from "~/components/command-palette/palette-commands";
import { initializeConsoleLogCapture } from "~/lib/console-log-capture";
import { cycleThemePreference, syncThemePreference } from "~/lib/theme-mode";
import { RouteProgressBar } from "./RouteProgressBar";
import { MobileAppBarContext } from "./mobile-app-bar";
import {
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "./sidebar-collapse-cookie";

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

  const [collapsed, setCollapsed] = createSignal(readSidebarCollapsed());
  const [cmdkOpen, setCmdkOpen] = createSignal(false);
  const [logsOpen, setLogsOpen] = createSignal(false);
  const [newNoteOpen, setNewNoteOpen] = createSignal(false);
  const [newNoteInitialTitle, setNewNoteInitialTitle] = createSignal<
    string | undefined
  >(undefined);
  const [mobileOpen, setMobileOpen] = createSignal(false);
  const [mobileBarTitle, setMobileBarTitle] = createSignal<string>();
  const [mobileBarSlot, setMobileBarSlot] = createSignal<HTMLElement>();
  const mobileAppBar = {
    setTitle: (title: string | undefined) => setMobileBarTitle(title),
    actionsSlot: mobileBarSlot,
  };

  const isExpanded = () => !collapsed();

  // Close the mobile drawer after any navigation (links inside it, palette,
  // back/forward) instead of in each link's click handler, which would
  // unmount the anchor before the router handles the click.
  const location = useLocation();
  createEffect(
    on(
      () => location.pathname,
      () => setMobileOpen(false),
      { defer: true }
    )
  );

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
    const next = !collapsed();
    setCollapsed(next);
    writeSidebarCollapsed(next);
  };

  const paletteActions: PaletteAction[] = [
    {
      key: "chat",
      label: "Open chat",
      keywords: "ai assistant llm ask",
      shortcut: "⌘I",
      icon: BotMessageSquareIcon,
      run: () => handleChatOpen(),
    },
    {
      key: "sidebar",
      label: "Toggle sidebar",
      keywords: "collapse expand navigation",
      shortcut: "⌘\\",
      icon: PanelLeftIcon,
      run: () => handleCollapseToggle(),
    },
    {
      key: "theme",
      label: "Change theme",
      keywords: "dark light mode appearance system",
      icon: SunMoonIcon,
      run: () => {
        cycleThemePreference();
      },
    },
    {
      key: "logs",
      label: "Console logs",
      keywords: "debug errors",
      shortcut: "⌘P",
      icon: TerminalIcon,
      run: () => setLogsOpen(true),
    },
  ];

  onMount(() => {
    initializeConsoleLogCapture();
    syncThemePreference();

    const off = onLLMSidebarEvent((e) => {
      if (e.type === "open") {
        openLLM(e.threadId);
      }
    });
    const onWindowKeyDown = (ev: KeyboardEvent) => {
      if (ev.defaultPrevented || ev.repeat) return;
      if (ev.metaKey !== true) return;
      const key = ev.key.toLowerCase();
      if (!ev.altKey && !ev.ctrlKey && !ev.shiftKey && key === "k") {
        ev.preventDefault();
        setCmdkOpen((prev) => !prev);
        return;
      }
      if (!ev.altKey && !ev.ctrlKey && !ev.shiftKey && key === "p") {
        ev.preventDefault();
        setLogsOpen((prev) => !prev);
        return;
      }
      if (!ev.altKey && !ev.ctrlKey && !ev.shiftKey && key === "d") {
        ev.preventDefault();
        handleNewNoteOpen();
        return;
      }
      if (!ev.altKey && !ev.ctrlKey && !ev.shiftKey && key === "i") {
        ev.preventDefault();
        handleChatOpen();
        return;
      }
      if (!ev.altKey && !ev.ctrlKey && !ev.shiftKey && ev.key === "\\") {
        ev.preventDefault();
        handleCollapseToggle();
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    onCleanup(() => {
      off();
      window.removeEventListener("keydown", onWindowKeyDown);
    });
  });

  return (
    <MobileAppBarContext.Provider value={mobileAppBar}>
      <RouteProgressBar />
      <Box minH="100dvh" bg="bg.default">
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
          title={mobileBarTitle()}
          actionsSlotRef={setMobileBarSlot}
        />
        <AppSidebarDesktop
          expanded={isExpanded()}
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
      </Box>

      {llmSidebarView}
      <CommandKMenu
        open={cmdkOpen()}
        onOpenChange={setCmdkOpen}
        onCreateNewNote={handleCreateNewNoteFromCmdk}
        actions={paletteActions}
      />
      <ConsoleLogsPanel open={logsOpen()} onClose={() => setLogsOpen(false)} />
      <NewNoteModal
        open={newNoteOpen()}
        onOpenChange={handleNewNoteOpenChange}
        initialTitle={newNoteInitialTitle()}
      />
    </MobileAppBarContext.Provider>
  );
};
