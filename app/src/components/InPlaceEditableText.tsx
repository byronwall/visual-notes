import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import { Box } from "styled-system/jsx";
import * as Editable from "~/components/ui/editable";
import { Text } from "~/components/ui/text";

type EditableActivationMode = "focus" | "dblclick" | "click" | "none";

type InPlaceEditableTextProps = {
  value: string;
  onCommit: (value: string) => void | Promise<void>;
  leadingAction?: (controls: {
    editing: boolean;
    startEditing: () => void;
  }) => JSX.Element;
  showLeadingAction?: boolean;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  minInputWidth?: string;
  trimOnCommit?: boolean;
  allowEmpty?: boolean;
  fillWidth?: boolean;
  wrapPreview?: boolean;
  truncatePreview?: boolean;
  placeholder?: string;
  activationMode?: EditableActivationMode;
  onStartEditingReady?: (startEditing: () => void) => void;
  previewHoverable?: boolean;
};

export const InPlaceEditableText = (props: InPlaceEditableTextProps) => {
  const [draft, setDraft] = createSignal(props.value);
  const [isEditing, setIsEditing] = createSignal(false);
  const [actionVisible, setActionVisible] = createSignal(false);
  const [saveError, setSaveError] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);
  const [previewTransition, setPreviewTransition] = createSignal(false);
  let commitPending = false;
  let editSession = 0;
  let editTriggerRef: HTMLButtonElement | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const editableValue = () =>
    isEditing() || isSaving() || previewTransition() ? draft() : props.value;
  const previewValue = () => {
    const value = editableValue();
    return value.trim() === "" ? props.placeholder ?? "" : value;
  };

  createEffect(() => {
    const next = props.value;
    if (isEditing() || isSaving() || previewTransition()) return;
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

  const cancelEdit = () => {
    editSession += 1;
    setPreviewTransition(false);
    setSaveError("");
    setDraft(props.value);
    setIsEditing(false);
  };

  const handleCommit = async (nextValue: string) => {
    setPreviewTransition(false);
    if (commitPending) {
      setIsEditing(true);
      return;
    }
    const session = editSession;
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
    setSaveError("");
    setIsSaving(true);
    commitPending = true;
    try {
      await props.onCommit(next);
    } catch (error) {
      if (session === editSession) {
        setSaveError(
          error instanceof Error && error.message
            ? error.message
            : "Failed to save. Try again.",
        );
        if (!isEditing()) setIsEditing(true);
      }
    } finally {
      commitPending = false;
      setIsSaving(false);
    }
  };

  const showLeadingAction = () => !!props.leadingAction && !!props.showLeadingAction;
  const startEditing = () => {
    setDraft(props.value);
    editTriggerRef?.click();
  };

  createEffect(() => {
    props.onStartEditingReady?.(startEditing);
  });

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
          {props.leadingAction?.({
            editing: isEditing(),
            startEditing,
          })}
        </Box>
      </Show>
      <Editable.Root
        width={props.fillWidth ? "full" : "fit-content"}
        edit={isEditing()}
        value={editableValue()}
        placeholder={props.placeholder}
        activationMode={props.activationMode ?? "click"}
        submitMode="both"
        selectOnFocus
        onEditChange={(details) => {
          if (details.edit) {
            editSession += 1;
            setPreviewTransition(false);
            setSaveError("");
            setIsEditing(true);
            return;
          }
          setPreviewTransition(true);
          setIsEditing(false);
        }}
        onValueChange={(details) => {
          if (!isEditing()) return;
          setSaveError("");
          setDraft(details.value);
        }}
        onValueCommit={(details) => void handleCommit(details.value)}
        onValueRevert={cancelEdit}
      >
        <Editable.EditTrigger
          ref={editTriggerRef}
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            opacity: "0",
            overflow: "hidden",
            "pointer-events": "none",
          }}
        />
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
              _hover={
                props.previewHoverable === false
                  ? undefined
                  : { bg: "gray.subtle", color: "fg.default" }
              }
              fontSize="inherit"
              fontWeight="inherit"
              lineHeight="inherit"
              display={props.wrapPreview || props.truncatePreview ? "block" : undefined}
              w={props.wrapPreview || props.truncatePreview ? "full" : undefined}
              whiteSpace={
                props.wrapPreview ? "normal" : props.truncatePreview ? "nowrap" : undefined
              }
              overflowWrap={props.wrapPreview ? "anywhere" : undefined}
              overflow={props.truncatePreview ? "hidden" : undefined}
              textOverflow={props.truncatePreview ? "ellipsis" : undefined}
              onKeyDown={(event) => {
                if (props.activationMode !== "dblclick" || event.key !== "Enter") return;
                event.preventDefault();
                event.stopPropagation();
                startEditing();
              }}
            >
              {previewValue()}
            </Editable.Preview>
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
      <Show when={isSaving()}>
        <Text as="div" role="status" fontSize="xs" color="fg.muted">
          Saving…
        </Text>
      </Show>
      <Show when={saveError()}>
        {(message) => (
          <Text as="div" role="alert" fontSize="xs" color="red.11">
            {message()}
          </Text>
        )}
      </Show>
    </Box>
  );
};
