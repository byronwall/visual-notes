import { revalidate } from "@solidjs/router";
import {
  createContext,
  onCleanup,
  onMount,
  useContext,
  type ParentComponent,
} from "solid-js";
import {
  NOTE_SOCKET_DISABLED_CLOSE_CODE,
  isNoteSocketServerMessage,
  type NoteSocketServerMessage,
  type NotesChangedEvent,
} from "~/lib/note-events";
import { createSocketClient, type SocketStatus } from "~/lib/socket-client";
import {
  NOTE_LIVE_DEBOUNCE_MS,
  NOTE_LIVE_QUERY_KEYS,
  NOTE_LIVE_STALE_AFTER_HIDDEN_MS,
} from "./note-live-keys";

type NotesChangedListener = (event: NotesChangedEvent) => void;

type NoteLiveSyncContextValue = {
  /** Called for every notes:changed event, and with `changes: null` after a gap. */
  onNotesChanged: (listener: NotesChangedListener) => () => void;
};

const NoteLiveSyncContext = createContext<NoteLiveSyncContextValue>();

export const NoteLiveSyncProvider: ParentComponent = (props) => {
  const listeners = new Set<NotesChangedListener>();
  let refreshTimer: number | undefined;

  const emit = (event: NotesChangedEvent) => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[note-live] listener failed", err);
      }
    }
  };

  const scheduleListRefresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      console.debug("[note-live] revalidating note queries");
      void revalidate([...NOTE_LIVE_QUERY_KEYS]);
    }, NOTE_LIVE_DEBOUNCE_MS);
  };

  const handleChanged = (event: NotesChangedEvent) => {
    console.debug("[note-live] notes changed", {
      changes: event.changes?.length ?? "all",
    });
    scheduleListRefresh();
    emit(event);
  };

  const catchUp = (reason: string) => {
    console.info("[note-live] catching up", { reason });
    handleChanged({
      type: "notes:changed",
      changes: null,
      at: new Date().toISOString(),
    });
  };

  // Client-only: the socket and visibility events exist only in the browser,
  // and the provider renders no markup, so SSR output is unaffected.
  onMount(() => {
    let status: SocketStatus = "idle";
    let hasOpened = false;
    let hiddenAt: number | null = null;

    const client = createSocketClient<NoteSocketServerMessage>({
      path: "/ws/notes",
      logPrefix: "note-live",
      stopOnCloseCodes: [NOTE_SOCKET_DISABLED_CLOSE_CODE],
      // The server greets on open and pings every 25s.
      watchdog: { firstMessageMs: 5_000, idleMs: 60_000 },
      parse: (value) => (isNoteSocketServerMessage(value) ? value : null),
      onMessage: (message) => {
        if (message.type === "notes:changed") handleChanged(message);
      },
      onStatus: (next) => {
        status = next;
        // Mirrors data-app-hydrated so tests and debugging can see the socket.
        document.documentElement.dataset.noteLive = next;
        if (next !== "open") return;
        // Events sent while disconnected are lost, so refresh once.
        if (hasOpened) catchUp("reconnected");
        hasOpened = true;
      },
    });

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (status === "closed" || status === "error") {
        // Skip the backoff wait; "idle" means the server turned sync off.
        client.connect();
      } else if (
        status === "open" &&
        hiddenFor > NOTE_LIVE_STALE_AFTER_HIDDEN_MS
      ) {
        catchUp("visible after long hide");
      }
    };

    client.connect();
    document.addEventListener("visibilitychange", handleVisibility);
    onCleanup(() => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearTimeout(refreshTimer);
      client.close();
    });
  });

  const value: NoteLiveSyncContextValue = {
    onNotesChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return (
    <NoteLiveSyncContext.Provider value={value}>
      {props.children}
    </NoteLiveSyncContext.Provider>
  );
};

/** Live note-change events, or `undefined` outside the signed-in app shell. */
export const useNoteLiveSync = () => useContext(NoteLiveSyncContext);
