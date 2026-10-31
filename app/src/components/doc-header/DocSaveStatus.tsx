import {
  Match,
  Switch,
  createSignal,
  onCleanup,
  onMount,
  type VoidComponent,
} from "solid-js";
import { Box, styled } from "styled-system/jsx";
import { loginPathFor } from "~/utils/safe-next";
import { formatRelativeShort } from "./relative-time";

export type SaveState = {
  saving: boolean;
  dirty: boolean;
  error?: string;
  updatedAt?: string;
};

// Server functions report a rejected session only through this message.
const sessionEnded = (error: string | undefined) =>
  !!error && /status 401\b/.test(error);

/**
 * One quiet line that answers "is my writing safe?": Saving…, Unsaved,
 * a retry on failure, or when the note was last saved. It doubles as the
 * activity trigger, so the header never shows two timestamps.
 */
export const DocSaveStatus: VoidComponent<{
  state: SaveState;
  onClick?: () => void;
  onRetry?: () => void;
  /** Makes "Unsaved" a button that saves now instead of waiting. */
  onSave?: () => void;
  ariaLabel?: string;
}> = (props) => {
  const [now, setNow] = createSignal(Date.now());
  onMount(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    onCleanup(() => clearInterval(timer));
  });

  const savedLabel = () => {
    const at = props.state.updatedAt;
    if (!at) return "Saved";
    return `Saved ${formatRelativeShort(now(), at)}`;
  };

  const absoluteTitle = () => {
    const at = props.state.updatedAt;
    if (!at || !Number.isFinite(Date.parse(at))) return undefined;
    return `${new Date(at).toISOString().replace("T", " ").slice(0, 16)} UTC`;
  };

  return (
    <Switch
      fallback={
        <styled.button
          type="button"
          onClick={() => props.onClick?.()}
          aria-label={props.ariaLabel}
          title={absoluteTitle()}
          fontSize="xs"
          color="fg.muted"
          px="1.5"
          h="7"
          borderRadius="l2"
          cursor="pointer"
          whiteSpace="nowrap"
          fontVariantNumeric="tabular-nums"
          focusVisibleRing="outside"
          transitionProperty="background-color, color"
          transitionDuration="140ms"
          _hover={{ bg: "gray.plain.bg.hover", color: "fg.default" }}
        >
          {savedLabel()}
        </styled.button>
      }
    >
      <Match when={sessionEnded(props.state.error)}>
        {/* A new tab keeps this page, and the unsaved text, open. The save
            retries when the user comes back. */}
        <styled.a
          href={loginPathFor(location.pathname)}
          target="_blank"
          rel="noopener"
          title="Your session ended. Sign in on the new tab, then come back. This note saves on its own."
          display="inline-flex"
          alignItems="center"
          fontSize="xs"
          fontWeight="medium"
          color="red.11"
          px="1.5"
          h="7"
          borderRadius="l2"
          cursor="pointer"
          whiteSpace="nowrap"
          focusVisibleRing="outside"
          _hover={{ bg: "red.a3" }}
        >
          Not saved · Sign in
        </styled.a>
      </Match>
      <Match when={props.state.error}>
        <styled.button
          type="button"
          onClick={() => props.onRetry?.()}
          title={`${props.state.error}. Retrying on its own. Click to retry now.`}
          fontSize="xs"
          fontWeight="medium"
          color="red.11"
          px="1.5"
          h="7"
          borderRadius="l2"
          cursor="pointer"
          whiteSpace="nowrap"
          focusVisibleRing="outside"
          _hover={{ bg: "red.a3" }}
        >
          Couldn't save · Retry
        </styled.button>
      </Match>
      <Match when={props.state.saving}>
        <StatusText>Saving…</StatusText>
      </Match>
      <Match when={props.state.dirty && props.onSave}>
        <styled.button
          type="button"
          onClick={() => props.onSave?.()}
          aria-label="Save note changes"
          title="Save now"
          fontSize="xs"
          color="fg.subtle"
          px="1.5"
          h="7"
          borderRadius="l2"
          cursor="pointer"
          whiteSpace="nowrap"
          focusVisibleRing="outside"
          transitionProperty="background-color, color"
          transitionDuration="140ms"
          _hover={{ bg: "gray.plain.bg.hover", color: "fg.default" }}
        >
          Unsaved
        </styled.button>
      </Match>
      <Match when={props.state.dirty}>
        <StatusText>Unsaved</StatusText>
      </Match>
    </Switch>
  );
};

function StatusText(props: { children: string }) {
  return (
    <Box
      as="span"
      role="status"
      display="inline-flex"
      alignItems="center"
      fontSize="xs"
      color="fg.subtle"
      px="1.5"
      h="7"
      whiteSpace="nowrap"
    >
      {props.children}
    </Box>
  );
}
