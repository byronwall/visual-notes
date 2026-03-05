import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
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
  fillWidth?: boolean;
  wrapPreview?: boolean;
  placeholder?: string;
};

export const InPlaceEditableText = (props: InPlaceEditableTextProps) => {
  const [draft, setDraft] = createSignal(props.value);
  const [isEditing, setIsEditing] = createSignal(false);
  const [actionVisible, setActionVisible] = createSignal(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const editableValue = () => (isEditing() ? draft() : props.value);

  createEffect(() => {
    const next = props.value;
    if (isEditing()) return;
    setDraft((prev) => {
      return prev === next ? prev : next;
    });
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
      setIsEditing(false);
      return;
    }
    if (next === previous) {
      setDraft(previous);
      setIsEditing(false);
      return;
    }
    setDraft(next);
    try {
      await props.onCommit(next);
    } catch {
      setDraft(previous);
    } finally {
      setIsEditing(false);
    }
  };

  const showLeadingAction = () => !!props.leadingAction && !!props.showLeadingAction;

  return (
    <Box
      as="span"
      display={props.fillWidth ? "block" : "inline-block"}
      w={props.fillWidth ? "full" : undefined}
      minW="0"
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
        width={props.fillWidth ? "full" : "fit-content"}
        value={editableValue()}
        placeholder={props.placeholder}
        activationMode="click"
        submitMode="both"
        selectOnFocus
        onEditChange={(details) => setIsEditing(details.edit)}
        onValueChange={(details) => {
          if (!isEditing()) return;
          setDraft(details.value);
        }}
        onValueCommit={(details) => void handleCommit(details.value)}
        onValueRevert={() => {
          setDraft(props.value);
          setIsEditing(false);
        }}
      >
        <Box
          as="span"
          m="0"
          fontSize={props.fontSize ?? "md"}
          fontWeight={props.fontWeight ?? "medium"}
          lineHeight={props.lineHeight ?? "1.2"}
          minW="0"
        >
          <Editable.Area
            cursor="text"
            w={props.fillWidth ? "full" : undefined}
            minW="0"
          >
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
              display={props.wrapPreview ? "block" : undefined}
              w={props.wrapPreview ? "full" : undefined}
              whiteSpace={props.wrapPreview ? "normal" : undefined}
              overflowWrap={props.wrapPreview ? "anywhere" : undefined}
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
