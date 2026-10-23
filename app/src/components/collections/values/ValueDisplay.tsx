import { ArrowUpRightIcon, MailIcon, PhoneIcon } from "lucide-solid";
import { For, Match, Show, Switch } from "solid-js";
import { css } from "styled-system/css";
import type {
  CollectionProperty,
  PropertyValue,
} from "~/lib/collections/types";
import {
  formatValueText,
  isDateValue,
  optionById,
} from "~/lib/collections/values";
import { OptionChip } from "./OptionChip";
import { RatingStars } from "./RatingStars";

const muted = css({ color: "fg.subtle" });
const truncate = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minW: "0",
});
const chips = css({
  display: "flex",
  gap: "1",
  flexWrap: "nowrap",
  overflow: "hidden",
  minW: "0",
  "& > *": { flexShrink: "0" },
});
const chipsWrap = css({
  display: "flex",
  gap: "1",
  flexWrap: "wrap",
  minW: "0",
});
// Colored text only, matching links in the note body.
const link = css({
  color: "fg.link",
  textDecoration: "none",
  transitionProperty: "color",
  transitionDuration: "140ms",
  _hover: { color: "fg.linkHover" },
});
const linkText = css({ color: "fg.link" });
const openButton = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  boxSize: "5",
  borderRadius: "l1",
  color: "fg.subtle",
  transitionProperty: "color, background-color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default", bg: "bg.hover" },
});
const progressTrack = css({
  flex: "1",
  h: "1.5",
  borderRadius: "full",
  bg: "bg.emphasized",
  overflow: "hidden",
  minW: "8",
  maxW: "24",
});
const progressFill = css({ h: "full", bg: "fg.muted", borderRadius: "full" });
const progressRow = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  minW: "0",
});
const checkboxBox = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "4",
  borderRadius: "l1",
  borderWidth: "1.5px",
  borderColor: "border.emphasized",
  color: "white",
  fontSize: "10px",
  "&[data-checked]": {
    bg: "fg.default",
    borderColor: "fg.default",
    _dark: { color: "black" },
  },
});

const hrefFor = (property: CollectionProperty, text: string) => {
  if (property.config.format === "url")
    return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (property.config.format === "email") return `mailto:${text}`;
  if (property.config.format === "phone")
    return `tel:${text.replace(/[^\d+]/g, "")}`;
  return undefined;
};

const displayUrl = (text: string) =>
  text.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

/**
 * Read-only rendering of a value; `wrap` lets chips and text use more lines.
 * `linkOpens: "button"` keeps link text clickable for editing and opens the
 * link from a trailing icon instead.
 */
export const ValueDisplay = (props: {
  property: CollectionProperty;
  value: PropertyValue;
  wrap?: boolean;
  placeholder?: string;
  linkOpens?: "text" | "button";
}) => {
  const linkLabel = () =>
    props.property.config.format === "url"
      ? displayUrl(String(props.value))
      : String(props.value);
  const empty = () =>
    props.value === null ||
    props.value === undefined ||
    props.value === "" ||
    (Array.isArray(props.value) && props.value.length === 0);
  return (
    <Show
      when={!empty() || props.property.kind === "checkbox"}
      fallback={
        <Show when={props.placeholder}>
          <span class={muted}>{props.placeholder}</span>
        </Show>
      }
    >
      <Switch
        fallback={
          <span class={truncate}>
            {formatValueText(props.property, props.value)}
          </span>
        }
      >
        <Match when={props.property.kind === "checkbox"}>
          <span
            class={checkboxBox}
            data-checked={props.value === true ? "" : undefined}
            aria-label={props.value ? "Checked" : "Unchecked"}
          >
            {props.value === true ? "✓" : ""}
          </span>
        </Match>
        <Match
          when={
            props.property.kind === "text" &&
            hrefFor(props.property, String(props.value))
          }
        >
          {(href) => (
            <Show
              when={props.linkOpens === "button"}
              fallback={
                <a
                  class={`${link} ${truncate}`}
                  href={href()}
                  target={
                    props.property.config.format === "url"
                      ? "_blank"
                      : undefined
                  }
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {linkLabel()}
                </a>
              }
            >
              <span class={`${linkText} ${truncate}`}>{linkLabel()}</span>
              <a
                class={openButton}
                href={href()}
                target={
                  props.property.config.format === "url" ? "_blank" : undefined
                }
                rel="noreferrer"
                aria-label={
                  props.property.config.format === "email"
                    ? `Email ${linkLabel()}`
                    : props.property.config.format === "phone"
                      ? `Call ${linkLabel()}`
                      : `Open ${linkLabel()}`
                }
                onClick={(e) => e.stopPropagation()}
              >
                <Switch fallback={<ArrowUpRightIcon size={13} />}>
                  <Match when={props.property.config.format === "email"}>
                    <MailIcon size={13} />
                  </Match>
                  <Match when={props.property.config.format === "phone"}>
                    <PhoneIcon size={13} />
                  </Match>
                </Switch>
              </a>
            </Show>
          )}
        </Match>
        <Match
          when={
            props.property.kind === "number" &&
            props.property.config.format === "rating"
          }
        >
          <RatingStars
            value={Number(props.value) || 0}
            max={props.property.config.ratingMax ?? 5}
          />
        </Match>
        <Match
          when={
            props.property.kind === "number" &&
            props.property.config.format === "progress"
          }
        >
          <span class={progressRow}>
            <span class={progressTrack}>
              <span
                class={progressFill}
                style={{
                  width: `${Math.max(0, Math.min(1, Number(props.value))) * 100}%`,
                }}
              />
            </span>
            <span>{formatValueText(props.property, props.value)}</span>
          </span>
        </Match>
        <Match
          when={
            props.property.kind === "select" || props.property.kind === "status"
          }
        >
          <Show when={optionById(props.property.config, props.value)}>
            {(option) => (
              <OptionChip
                option={option()}
                showDot={props.property.kind === "status"}
              />
            )}
          </Show>
        </Match>
        <Match when={props.property.kind === "multi_select"}>
          <span class={props.wrap ? chipsWrap : chips}>
            <For
              each={(props.value as string[])
                .map((id) => optionById(props.property.config, id))
                .filter(Boolean)}
            >
              {(option) => <OptionChip option={option!} />}
            </For>
          </span>
        </Match>
        <Match
          when={
            props.property.kind === "number" &&
            props.property.config.format !== "plain"
          }
        >
          <span
            class={truncate}
            style={{ "font-variant-numeric": "tabular-nums" }}
          >
            {formatValueText(props.property, props.value)}
          </span>
        </Match>
        <Match when={props.property.kind === "number"}>
          <span
            class={truncate}
            style={{ "font-variant-numeric": "tabular-nums" }}
          >
            {formatValueText(props.property, props.value)}
          </span>
        </Match>
        <Match when={isDateValue(props.value)}>
          <span class={truncate}>
            {formatValueText(props.property, props.value)}
          </span>
        </Match>
      </Switch>
    </Show>
  );
};
