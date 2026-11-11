import { ChevronDownIcon } from "lucide-solid";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { css, cx } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import type {
  CollectionProperty,
  CollectionRow,
  DateValue,
  PropertyValue,
} from "~/lib/collections/types";
import {
  isComputedKind,
  isDateValue,
  numberDraft,
  parseNumberDraft,
  readValue,
} from "~/lib/collections/values";
import type { CollectionStore } from "../store/createCollectionStore";
import { DateEditor } from "./DateEditor";
import { type EditEnd, InlineEditor } from "./InlineEditor";
import { OptionPicker } from "./OptionPicker";
import { RatingStars } from "./RatingStars";
import { ValueDisplay } from "./ValueDisplay";
import {
  emptyPrompt,
  isInlineKind,
  isPlainText,
  isPopoverKind,
  isRating,
} from "./valueKinds";
import { fitContent } from "../popover-styles";

const INVALID_FLASH_MS = 2000;

const base = css({
  display: "flex",
  alignItems: "center",
  minW: "0",
  w: "full",
  h: "full",
  outline: "none",
  cursor: "default",
  position: "relative",
  transitionProperty: "background-color, border-color, box-shadow",
  transitionDuration: "140ms",
});
const cellVariant = css({
  px: "2",
  minH: "8",
  fontSize: "sm",
  "&[data-invalid]": {
    bg: "red.a2",
    boxShadow: "inset 0 0 0 2px token(colors.red.a7)",
  },
});
// Fields read as form inputs: a soft resting fill across the value column,
// an outline on hover, and an accent outline while typing.
const fieldVariant = css({
  gap: "1.5",
  px: "2",
  minH: "8",
  h: "auto",
  fontSize: "sm",
  borderRadius: "l2",
  borderWidth: "1px",
  borderColor: "transparent",
  bg: "gray.a2",
  "[data-property-line]:hover &": { bg: "bg.default", borderColor: "border" },
  "&[data-readonly]": { bg: "transparent", borderColor: "transparent" },
  _focusVisible: { bg: "bg.default", borderColor: "border.accent" },
  "&[data-open]": { bg: "bg.default", borderColor: "border" },
  "&[data-multiline][data-editing]": {
    bg: "bg.default",
    borderColor: "border.accent",
  },
  "&[data-invalid]": { bg: "red.a2", borderColor: "red.a7" },
  "&:focus-visible [data-chevron]": { opacity: "1" },
  // Touch screens edit at 16px (see global-css), so values show at 16px too
  // and nothing reflows when editing starts.
  "@media (pointer: coarse)": { fontSize: "md" },
});
// Spans the field's padding so pickers line up with its outer edge.
const fieldAnchor = css({
  alignSelf: "stretch",
  mx: "-2",
  px: "2",
  w: "calc(100% + token(spacing.4))",
  gap: "1.5",
});
const chevron = css({
  ml: "auto",
  flexShrink: "0",
  color: "fg.subtle",
  opacity: "0",
  transitionProperty: "opacity",
  transitionDuration: "140ms",
  "[data-property-line]:hover &": { opacity: "1" },
  "@media (hover: none)": { opacity: "1" },
});
const editable = css({ cursor: "pointer" });

/**
 * One editable value: a table cell (`cell`) or a property-list field
 * (`field`). Text and numbers edit in place; options and dates open a picker.
 * With `wrap`, a field shows plain text on as many lines as it needs.
 */
export const ValueCell = (props: {
  property: CollectionProperty;
  row: CollectionRow;
  store: CollectionStore;
  variant?: "cell" | "field";
  wrap?: boolean;
  /** Open the editor on mount, e.g. for a property that was just added. */
  autoEdit?: boolean;
  /** Called with the element so a grid can manage focus. */
  ref?: (el: HTMLDivElement) => void;
  onEditEnd?: (reason: "commit" | "cancel" | "tab" | "shift-tab") => void;
}) => {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [flash, setFlash] = createSignal(false);
  let root: HTMLDivElement | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(flashTimer));

  const value = () => readValue(props.row, props.property);
  const readOnly = () => isComputedKind(props.property.kind);
  const isField = () => props.variant === "field";
  const multiline = () =>
    isField() && Boolean(props.wrap) && isPlainText(props.property);

  const save = (next: PropertyValue) =>
    void props.store.setValues([props.row.id], { [props.property.id]: next });

  const shownText = () =>
    props.property.kind === "number"
      ? numberDraft(props.property.config, value())
      : String(value() ?? "");

  const start = (initial?: string) => {
    if (readOnly() || isRating(props.property)) return;
    if (props.property.kind === "checkbox") {
      save(value() === true ? null : true);
      return;
    }
    if (isInlineKind(props.property)) setDraft(initial ?? shownText());
    setError(null);
    setEditing(true);
  };

  const flashInvalid = () => {
    clearTimeout(flashTimer);
    setFlash(true);
    flashTimer = setTimeout(() => setFlash(false), INVALID_FLASH_MS);
  };

  // A blur means the user clicked elsewhere, so focus stays where it went.
  const finish = (reason: EditEnd) => {
    if (!editing()) return;
    const blur = reason === "blur";
    let next: { value: PropertyValue } | null = null;
    if (reason !== "cancel" && isInlineKind(props.property)) {
      const text = draft();
      if (props.property.kind === "number") {
        const parsed = parseNumberDraft(props.property, text);
        if ("error" in parsed) {
          // Keep the editor open so the user can fix it. A blur cannot keep
          // focus, so it reverts and marks the cell instead.
          if (!blur) return void setError(parsed.error);
          setEditing(false);
          setError(null);
          flashInvalid();
          props.onEditEnd?.("cancel");
          return;
        }
        if (parsed.value !== value()) next = { value: parsed.value };
      } else if (text !== (value() ?? "")) {
        next = { value: text.trim() ? text : null };
      }
    }
    setEditing(false);
    setError(null);
    if (next) save(next.value);
    if (!blur) queueMicrotask(() => root?.focus());
    props.onEditEnd?.(blur ? "commit" : reason);
  };

  createEffect(
    on(
      () => props.autoEdit,
      (auto) => {
        if (
          auto &&
          (isInlineKind(props.property) || isPopoverKind(props.property))
        )
          start();
      },
    ),
  );

  const onKeyDown = (e: KeyboardEvent) => {
    if (editing()) return;
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      e.stopPropagation();
      start();
    } else if (e.key === " " && props.property.kind === "checkbox") {
      e.preventDefault();
      start();
    } else if ((e.key === "Backspace" || e.key === "Delete") && !readOnly()) {
      e.preventDefault();
      save(null);
    } else if (
      e.key.length === 1 &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      isInlineKind(props.property)
    ) {
      // Typing on a focused cell replaces its value, like a spreadsheet. A
      // field adds to its value instead, so a stray key keeps long text.
      e.preventDefault();
      start(isField() ? shownText() + e.key : e.key);
    }
  };

  // A function, not a node: JSX created away from its insertion point breaks
  // hydration ordering.
  const display = () => (
    <Switch
      fallback={
        <ValueDisplay
          property={props.property}
          value={value()}
          wrap={props.wrap}
          multiline={multiline()}
          placeholder={isField() ? emptyPrompt(props.property) : undefined}
          linkOpens={isField() ? "button" : "text"}
        />
      }
    >
      <Match when={isRating(props.property)}>
        <RatingStars
          value={Number(value()) || 0}
          max={props.property.config.ratingMax ?? 5}
          label={props.property.name}
          onChange={(n) => save(n)}
        />
      </Match>
    </Switch>
  );

  return (
    <div
      ref={(el) => {
        root = el;
        props.ref?.(el);
      }}
      class={cx(
        base,
        isField() ? fieldVariant : cellVariant,
        !readOnly() && editable,
      )}
      tabIndex={0}
      data-cell=""
      data-editing={editing() && isInlineKind(props.property) ? "" : undefined}
      data-open={editing() ? "" : undefined}
      data-readonly={readOnly() ? "" : undefined}
      data-multiline={multiline() ? "" : undefined}
      data-invalid={flash() ? "" : undefined}
      data-property-id={props.property.id}
      aria-label={props.property.name}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (!editing()) start();
      }}
    >
      <Show
        when={isPopoverKind(props.property)}
        fallback={<Show when={!(editing() && multiline())}>{display()}</Show>}
      >
        <SimplePopover
          open={editing()}
          onClose={() => finish("blur")}
          placement="bottom-start"
          offset={4}
          class={fitContent}
          anchorClass={cx(
            css({
              minW: "0",
              w: "full",
              display: "flex",
              alignItems: "center",
              minH: "6",
            }),
            isField() && fieldAnchor,
          )}
          anchor={
            <>
              {display()}
              <Show when={isField()}>
                <ChevronDownIcon size={14} class={chevron} data-chevron="" />
              </Show>
            </>
          }
        >
          <Show
            when={props.property.kind === "date"}
            fallback={
              <OptionPicker
                property={props.property}
                value={value() as string | string[] | null}
                onChange={(next) => save(next)}
                onCreate={(name) =>
                  props.store.createOption(props.property.id, name)
                }
                onDone={() => finish("commit")}
              />
            }
          >
            <DateEditor
              value={isDateValue(value()) ? (value() as DateValue) : null}
              includeTime={Boolean(props.property.config.includeTime)}
              onChange={(next) => save(next)}
              onDone={() => finish("commit")}
            />
          </Show>
        </SimplePopover>
      </Show>
      <Show when={editing() && isInlineKind(props.property)}>
        <InlineEditor
          value={draft()}
          multiline={multiline()}
          label={props.property.name}
          inputMode={
            props.property.kind === "number"
              ? "decimal"
              : props.property.config.format === "email"
                ? "email"
                : undefined
          }
          placeholder={isField() ? emptyPrompt(props.property) : undefined}
          error={error()}
          anchor={root}
          onInput={(text) => {
            setDraft(text);
            setError(null);
          }}
          onEnd={finish}
        />
      </Show>
    </div>
  );
};
