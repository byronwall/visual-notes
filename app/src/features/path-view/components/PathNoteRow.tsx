import { A } from "@solidjs/router";
import { Show, Suspense, type Accessor } from "solid-js";
import { css } from "styled-system/css";
import { renderHighlighted } from "~/features/docs-index/utils/highlight";
import { formatAbsoluteTime, formatRelativeTime } from "~/features/docs-index/utils/time";
import { pathToRoute } from "~/utils/path-links";
import { relativeNotePath, type PathNote } from "../utils/path-notes";
import { PathHoverCard } from "./PathHoverCard";

const rowClass = css({
  position: "relative",
  display: "grid",
  // Fixed time column so titles wrap at the same width on every row.
  gridTemplateColumns: "minmax(0, 1fr) 64px",
  gridTemplateAreas: '"main time" "sub sub"',
  // Lay out against the list width, not the viewport, so the rail never squeezes titles.
  "@container (min-width: 640px)": {
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 180px) 64px",
    gridTemplateAreas: '"main sub time"',
    // No row in this list lives in a subpath: give the title the space.
    "&[data-nosub]": {
      gridTemplateColumns: "minmax(0, 1fr) 64px",
      gridTemplateAreas: '"main time"',
    },
  },
  alignItems: "start",
  columnGap: "4",
  rowGap: "0",
  px: "3",
  py: "2",
  mx: "-3",
  borderRadius: "l2",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "bg.muted" },
  "&[data-active]": { bg: "bg.selected", color: "fg.selected" },
  // Long lists ("Show more" up to thousands): skip layout/paint for rows off screen.
  contentVisibility: "auto",
  containIntrinsicSize: "auto 61px",
});

const titleLinkClass = css({
  display: "block",
  fontSize: "md",
  fontWeight: "medium",
  lineHeight: "1.4",
  color: "fg.default",
  textDecoration: "none",
  outline: "none",
  wordBreak: "break-word",
  // Stretch the title link so the whole row opens the note.
  _after: { content: '""', position: "absolute", inset: "0", borderRadius: "l2" },
  _focusVisible: { _after: { boxShadow: "0 0 0 2px token(colors.gray.8)" } },
});

const snippetClass = css({
  minH: "5",
  mt: "0.5",
  fontSize: "sm",
  lineHeight: "1.45",
  color: "fg.muted",
  lineClamp: "1",
});

const subpathClass = css({
  gridArea: "sub",
  position: "relative",
  zIndex: 1,
  justifySelf: "start",
  maxW: "full",
  "@container (min-width: 640px)": { pt: "0.5" },
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: "mono",
  fontSize: "xs",
  color: "fg.muted",
  textDecoration: "none",
  _hover: { color: "fg.default", textDecoration: "underline" },
});

const timeClass = css({
  gridArea: "time",
  pt: "0.5",
  textAlign: "right",
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

export const PathNoteRow = (props: {
  note: PathNote;
  basePath: string;
  query: string;
  active: boolean;
  showSubpath: boolean;
  preview: Accessor<string | undefined>;
}) => {
  const subpath = () => relativeNotePath(props.note.path, props.basePath);
  const title = () => props.note.title || "Untitled";

  return (
    <li
      class={rowClass}
      data-active={props.active ? "" : undefined}
      data-note-id={props.note.id}
      data-nosub={props.showSubpath ? undefined : ""}
    >
      <div class={css({ gridArea: "main", minW: "0" })}>
        <A href={`/docs/${props.note.id}`} class={titleLinkClass}>
          {props.query ? renderHighlighted(title(), props.query) : title()}
        </A>
        <p class={snippetClass}>
          <Suspense fallback={" "}>{props.preview() || " "}</Suspense>
        </p>
      </div>
      <Show when={props.showSubpath && subpath()}>
        <PathHoverCard path={props.note.path || ""}>
          {(triggerProps) => (
            <A {...triggerProps} href={pathToRoute(props.note.path || "")} class={subpathClass}>
              {props.query ? renderHighlighted(subpath(), props.query) : subpath()}
            </A>
          )}
        </PathHoverCard>
      </Show>
      <span class={timeClass} title={`Updated ${formatAbsoluteTime(props.note.updatedAt)}`}>
        {formatRelativeTime(props.note.updatedAt)}
      </span>
    </li>
  );
};
