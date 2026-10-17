import {
  Match,
  Switch,
  createSignal,
  onCleanup,
  onMount,
  type VoidComponent,
} from "solid-js";
import { Box, styled } from "styled-system/jsx";
import { formatRelativeShort } from "./relative-time";

export type SaveState = {
  saving: boolean;
  dirty: boolean;
  error?: string;
  updatedAt?: string;
};

/**
 * One quiet line that answers "is my writing safe?": Saving…, Unsaved,
 * a retry on failure, or when the note was last saved. It doubles as the
 * activity trigger, so the header never shows two timestamps.
 */
export const DocSaveStatus: VoidComponent<{
  state: SaveState;
  onClick?: () => void;
  onRetry?: () => void;
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
      <Match when={props.state.error}>
        <styled.button
          type="button"
          onClick={() => props.onRetry?.()}
          title={props.state.error}
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
