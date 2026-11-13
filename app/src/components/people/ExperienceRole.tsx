import { A } from "@solidjs/router";
import { LinkIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import {
  durationLabel,
  formatPeriod,
  statusNote,
} from "~/lib/people/career-periods";
import type { Affiliation } from "~/lib/people/types";

const row = css({
  position: "relative",
  py: "1.5",
  fontSize: "sm",
  lineHeight: "1.45",
  "&:hover [data-row-actions], &:focus-within [data-row-actions]": {
    opacity: 1,
  },
  "&[data-timeline]": { pl: "5" },
  // The dot and the rule that joins roles at one employer.
  "&[data-timeline]::before": {
    content: '""',
    position: "absolute",
    left: "1",
    top: "3",
    w: "2",
    h: "2",
    borderRadius: "full",
    bg: "fg.subtle",
  },
  "&[data-timeline]:not(:last-child)::after": {
    content: '""',
    position: "absolute",
    left: "calc(var(--spacing-1) + 3px)",
    top: "5",
    bottom: "-1.5",
    w: "2px",
    bg: "border",
  },
});
const title = css({ fontWeight: "semibold", color: "fg.default" });
const metaLine = css({ color: "fg.muted", fontSize: "xs" });
const body = css({ mt: "0.5", color: "fg.default" });
const source = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  mt: "0.5",
  fontSize: "xs",
  color: "blue.11",
  "&:hover": { textDecoration: "underline" },
});
const tag = css({
  display: "inline-block",
  ml: "2",
  px: "1.5",
  borderRadius: "l1",
  fontSize: "xs",
  lineHeight: "1.5",
  fontWeight: "medium",
  verticalAlign: "1px",
  "&[data-status=current]": { bg: "green.3", color: "green.11" },
  "&[data-status=unknown]": {
    borderWidth: "1px",
    borderColor: "border",
    color: "fg.muted",
  },
});
const actions = css({
  display: "flex",
  gap: "0.5",
  mt: "1",
  md: {
    mt: "0",
    opacity: 0,
    position: "absolute",
    right: "0",
    top: "1",
    bg: "bg.default",
  },
});
const muted = css({ "& > *:not([data-row-actions])": { opacity: 0.75 } });

/** One role: title, honest period, place, what they did, and its source. */
export function ExperienceRole(props: {
  role: Affiliation;
  timeline: boolean;
  onEdit: () => void;
  onEnd: () => void;
  onRemove: () => void;
}) {
  const a = () => props.role;
  // Period, length, place, and how fresh a current claim is, on one line.
  const meta = () =>
    [
      formatPeriod(a()),
      durationLabel(a()),
      a().location,
      a().status === "current" ? statusNote(a()) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const sourceText = () => a().sourceLabel || "Source";

  return (
    <div
      class={`${row} ${a().status === "unknown" ? muted : ""}`}
      data-timeline={props.timeline ? "" : undefined}
      data-role={a().role ?? a().organization.name}
    >
      <div>
        <span class={title}>{a().role ?? "Role not recorded"}</span>
        <Show when={a().status !== "ended"}>
          <span class={tag} data-status={a().status}>
            {a().status === "current" ? "Current" : "Status unknown"}
          </span>
        </Show>
      </div>
      <div class={metaLine}>{meta()}</div>
      <Show when={a().responsibilities}>
        <div class={body}>{a().responsibilities}</div>
      </Show>
      <Show when={a().sourceUrl || a().source}>
        <Show
          when={a().source}
          fallback={
            <a
              class={source}
              href={a().sourceUrl!}
              target="_blank"
              rel="noreferrer"
            >
              <LinkIcon size={12} aria-hidden="true" />
              {sourceText()}
            </a>
          }
        >
          {(note) => (
            <A class={source} href={`/docs/${note().id}`}>
              <LinkIcon size={12} aria-hidden="true" />
              {a().sourceLabel || note().title || "Source note"}
            </A>
          )}
        </Show>
      </Show>
      <div class={actions} data-row-actions>
        <Button size="xs" variant="plain" onClick={props.onEdit}>
          Edit
        </Button>
        <Show when={a().status === "current"}>
          <Button
            size="xs"
            variant="plain"
            title="Mark ended without inventing an end date"
            onClick={props.onEnd}
          >
            End
          </Button>
        </Show>
        <Button
          size="xs"
          variant="plain"
          title="Remove a wrong role. To record that it ended, use End or Edit."
          onClick={props.onRemove}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
