import { Show, createEffect, createSignal, onCleanup, type JSX } from "solid-js";
import { Box } from "styled-system/jsx";
import * as Editable from "~/components/ui/editable";

type InPlaceEditableTextProps = {
  value: string;
  onCommit: (value: string) => void | Promise<void>;
  leadingAction?: () => JSX.Element;
  showLeadingAction?: boolean;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  minInputWidth?: string;
  trimOnCommit?: boolean;
  allowEmpty?: boolean;
};

export const InPlaceEditableText = (props: InPlaceEditableTextProps) => {
  const [draft, setDraft] = createSignal("");
  const [actionVisible, setActionVisible] = createSignal(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    const next = props.value;
    setDraft((prev) => (prev === next ? prev : next));
  });

  onCleanup(() => {
    if (!hideTimer) return;
    clearTimeout(hideTimer);
  });

  const clearHideTimer = () => {
    if (!hideTimer) return;
    clearTimeout(hideTimer);
    hideTimer = undefined;
  };

  const showAction = () => {
    clearHideTimer();
    setActionVisible(true);
  };

  const hideActionSoon = () => {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      setActionVisible(false);
      hideTimer = undefined;
    }, 160);
  };

  const handleCommit = async (nextValue: string) => {
    const previous = props.value;
    const normalize = props.trimOnCommit ?? true;
    const next = normalize ? nextValue.trim() : nextValue;
    if (!next && !(props.allowEmpty ?? false)) {
      setDraft(previous);
      return;
    }
    if (next === previous) {
      setDraft(previous);
      return;
    }
    setDraft(next);
    try {
      await props.onCommit(next);
    } catch {
      setDraft(previous);
    }
  };

  const showLeadingAction = () => !!props.leadingAction && !!props.showLeadingAction;

  return (
    <Box
      as="span"
      display="inline-block"
      position="relative"
      onMouseEnter={showAction}
      onMouseLeave={hideActionSoon}
      onFocusIn={showAction}
      onFocusOut={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) {
          hideActionSoon();
        }
      }}
    >
      <Show when={showLeadingAction()}>
        <Box
          position="absolute"
          top="50%"
          right="100%"
          zIndex="1"
          style={{
            transform: actionVisible()
              ? "translate(-0.625rem, -50%)"
              : "translate(-0.375rem, -50%)",
            opacity: actionVisible() ? "1" : "0",
            "pointer-events": actionVisible() ? "auto" : "none",
            transition:
              "opacity 140ms ease, transform 140ms ease, visibility 140ms ease",
            visibility: actionVisible() ? "visible" : "hidden",
          }}
          onMouseEnter={showAction}
          onMouseLeave={hideActionSoon}
          onFocusIn={showAction}
          onFocusOut={(e) => {
            const next = e.relatedTarget as Node | null;
            if (!next || !e.currentTarget.contains(next)) {
              hideActionSoon();
            }
          }}
        >
          {props.leadingAction?.()}
        </Box>
      </Show>
      <Editable.Root
        width="fit-content"
        value={draft()}
        activationMode="click"
        submitMode="both"
        selectOnFocus
        onValueChange={(details) => setDraft(details.value)}
        onValueCommit={(details) => void handleCommit(details.value)}
        onValueRevert={() => setDraft(props.value)}
      >
        <Box
          as="span"
          m="0"
          fontSize={props.fontSize ?? "md"}
          fontWeight={props.fontWeight ?? "medium"}
          lineHeight={props.lineHeight ?? "1.2"}
          minW="0"
        >
          <Editable.Area cursor="text">
            <Editable.Preview
              px="0"
              py="0"
              borderRadius="l1"
              cursor="pointer"
              transitionProperty="common"
              transitionDuration="normal"
              _hover={{ bg: "gray.subtle", color: "fg.default" }}
              fontSize="inherit"
              fontWeight="inherit"
              lineHeight="inherit"
            />
            <Editable.Input
              px="0"
              py="0"
              bg="transparent"
              borderRadius="0"
              fontSize="inherit"
              fontWeight="inherit"
              lineHeight="inherit"
              minW={props.minInputWidth ?? "12rem"}
            />
          </Editable.Area>
        </Box>
      </Editable.Root>
    </Box>
  );
};
