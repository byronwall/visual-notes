import { ChevronDownIcon } from "lucide-solid";
import { Match, Show, Switch, createSignal } from "solid-js";
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
  parseLooseText,
  readValue,
} from "~/lib/collections/values";
import type { CollectionStore } from "../store/createCollectionStore";
import { DateEditor } from "./DateEditor";
import { OptionPicker } from "./OptionPicker";
import { RatingStars } from "./RatingStars";
import { ValueDisplay } from "./ValueDisplay";
import { fitContent } from "../popover-styles";
import { noAutofill } from "~/components/ui/no-autofill";

const base = css({
  display: "flex",
  alignItems: "center",
  minW: "0",
  w: "full",
  h: "full",
  outline: "none",
  cursor: "default",
  position: "relative",
});
const cellVariant = css({ px: "2", minH: "8", fontSize: "sm" });
// Fields read as form inputs: a soft resting fill sized to the value, an
// outline on hover, and the full column while typing.
const fieldVariant = css({
  gap: "1.5",
  w: "fit-content",
  minW: "44",
  maxW: "full",
  px: "2",
  minH: "8",
  fontSize: "sm",
  borderRadius: "l2",
  borderWidth: "1px",
  borderColor: "transparent",
  bg: "gray.a2",
  transitionProperty: "background-color, border-color",
  transitionDuration: "140ms",
  "[data-property-line]:hover &": { bg: "bg.default", borderColor: "border" },
  "&[data-readonly]": { bg: "transparent", borderColor: "transparent" },
  _focusVisible: { bg: "bg.default", borderColor: "border.accent" },
  "&[data-open]": { bg: "bg.default", borderColor: "border" },
  "&[data-editing]": { w: "full", maxW: "28rem" },
  "&:focus-visible [data-chevron]": { opacity: "1" },
});
const chevron = css({
  ml: "auto",
  flexShrink: "0",
  color: "fg.subtle",
  opacity: "0",
  transitionProperty: "opacity",
  transitionDuration: "140ms",
  "[data-property-line]:hover &": { opacity: "1" },
});
const editable = css({ cursor: "pointer" });
const inlineInput = css({
  position: "absolute",
  inset: "0",
  w: "full",
  px: "2",
  fontSize: "sm",
  bg: "bg.default",
  outline: "none",
  boxShadow: "inset 0 0 0 2px token(colors.border.accent)",
  borderRadius: "l1",
  zIndex: "1",
});

const isPopoverKind = (property: CollectionProperty) =>
  property.kind === "select" ||
  property.kind === "status" ||
  property.kind === "multi_select" ||
  property.kind === "date";

/** What an empty field offers to do, so blank values still read as inputs. */
const emptyPrompt = (property: CollectionProperty) => {
  if (isComputedKind(property.kind)) return "—";
  switch (property.kind) {
    case "select":
    case "status":
      return "Choose…";
    case "multi_select":
      return "Add…";
    case "date":
      return "Pick a date";
    case "number":
      return property.config.format === "currency"
        ? "Add amount"
        : "Add number";
    default:
      if (property.config.format === "url") return "Add link";
      if (property.config.format === "email") return "Add email";
      if (property.config.format === "phone") return "Add phone";
      return "Add text";
  }
};

const isInlineKind = (property: CollectionProperty) =>
  (property.kind === "text" || property.kind === "number") &&
  property.config.format !== "rating";

/**
 * One editable value: a table cell (`cell`) or a property-list field
 * (`field`). Text and numbers edit in place; options and dates open a picker.
 */
export const ValueCell = (props: {
  property: CollectionProperty;
  row: CollectionRow;
  store: CollectionStore;
  variant?: "cell" | "field";
  wrap?: boolean;
  /** Called with the element so a grid can manage focus. */
  ref?: (el: HTMLDivElement) => void;
  onEditEnd?: (reason: "commit" | "cancel" | "tab" | "shift-tab") => void;
}) => {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let root: HTMLDivElement | undefined;
  const value = () => readValue(props.row, props.property);
  const readOnly = () => isComputedKind(props.property.kind);

  const save = (next: PropertyValue) =>
    void props.store.setValues([props.row.id], { [props.property.id]: next });

  const start = (initial?: string) => {
    if (readOnly()) return;
    if (props.property.kind === "checkbox") {
      save(value() === true ? null : true);
      return;
    }
    if (
      props.property.kind === "number" &&
      props.property.config.format === "rating"
    )
      return;
    if (isInlineKind(props.property)) {
      const current = value();
      const shown =
        props.property.kind === "number" && typeof current === "number"
          ? String(
              props.property.config.format === "percent" ||
                props.property.config.format === "progress"
                ? Number((current * 100).toFixed(6))
                : current,
            )
          : String(current ?? "");
      setDraft(initial ?? shown);
    }
    setEditing(true);
  };

  // `refocus` is false when the user clicked elsewhere: focus belongs there.
  const finish = (
    reason: "commit" | "cancel" | "tab" | "shift-tab",
    refocus = true,
  ) => {
    if (!editing()) return;
    setEditing(false);
    if (reason !== "cancel" && isInlineKind(props.property)) {
      const text = draft();
      if (props.property.kind === "number") {
        const pct =
          props.property.config.format === "percent" ||
          props.property.config.format === "progress";
        const parsed = parseLooseText(props.property, text);
        if (!parsed.failed) {
          const next =
            typeof parsed.value === "number" &&
            pct &&
            !text.trim().endsWith("%")
              ? parsed.value / 100
              : parsed.value;
          if (next !== value()) save(next);
        }
      } else if (text !== (value() ?? "")) {
        save(text.trim() ? text : null);
      }
    }
    if (refocus) queueMicrotask(() => root?.focus());
    props.onEditEnd?.(reason);
  };

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
      // Typing on a focused cell replaces its value, like a spreadsheet.
      e.preventDefault();
      start(e.key);
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
          placeholder={
            props.variant === "field" ? emptyPrompt(props.property) : undefined
          }
          linkOpens={props.variant === "field" ? "button" : "text"}
        />
      }
    >
      <Match
        when={
          props.property.kind === "number" &&
          props.property.config.format === "rating"
        }
      >
        <RatingStars
          value={Number(value()) || 0}
          max={props.property.config.ratingMax ?? 5}
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
        props.variant === "field" ? fieldVariant : cellVariant,
        !readOnly() && editable,
      )}
      tabIndex={0}
      data-cell=""
      data-editing={editing() && isInlineKind(props.property) ? "" : undefined}
      data-open={editing() ? "" : undefined}
      data-readonly={readOnly() ? "" : undefined}
      data-property-id={props.property.id}
      aria-label={props.property.name}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (!editing()) start();
      }}
    >
      <Show when={isPopoverKind(props.property)} fallback={display()}>
        <SimplePopover
          open={editing()}
          onClose={() => finish("commit", false)}
          placement="bottom-start"
          offset={4}
          class={fitContent}
          anchorClass={css({
            minW: "0",
            w: "full",
            display: "flex",
            alignItems: "center",
            minH: "6",
          })}
          anchor={
            <>
              {display()}
              <Show when={props.variant === "field"}>
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
        <input
          {...noAutofill}
          class={inlineInput}
          value={draft()}
          inputMode={
            props.property.kind === "number"
              ? "decimal"
              : props.property.config.format === "email"
                ? "email"
                : undefined
          }
          placeholder={
            props.variant === "field" ? emptyPrompt(props.property) : undefined
          }
          aria-label={`Edit ${props.property.name}`}
          ref={(el) =>
            queueMicrotask(() => {
              el.focus();
              const end = el.value.length;
              el.setSelectionRange(end, end);
            })
          }
          onClick={(e) => e.stopPropagation()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => finish("commit", false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              finish("commit");
            } else if (e.key === "Escape") {
              e.preventDefault();
              finish("cancel");
            } else if (e.key === "Tab") {
              e.preventDefault();
              finish(e.shiftKey ? "shift-tab" : "tab");
            }
          }}
        />
      </Show>
    </div>
  );
};
