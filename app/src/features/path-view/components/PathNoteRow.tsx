import { A } from "@solidjs/router";
import { Show, Suspense, type Accessor } from "solid-js";
import { css } from "styled-system/css";
import { renderHighlighted } from "~/features/docs-index/utils/highlight";
import { formatAbsoluteTime, formatRelativeTime } from "~/features/docs-index/utils/time";
import { pathToRoute } from "~/utils/path-links";
import { relativeNotePath, type PathNote } from "../utils/path-notes";

const rowClass = css({
  position: "relative",
  display: "grid",
  gridTemplateColumns: { base: "minmax(0, 1fr) auto", md: "minmax(0, 1fr) minmax(0, 200px) 64px" },
  gridTemplateAreas: { base: '"main time" "main sub"', md: '"main sub time"' },
  alignItems: "start",
  columnGap: "4",
  rowGap: "0.5",
  px: "3",
  py: "2",
  mx: "-3",
  borderRadius: "l2",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "bg.muted" },
  "&[data-active]": { bg: "gray.a3" },
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
  justifySelf: { base: "end", md: "start" },
  maxW: "full",
  pt: "0.5",
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
  onHover: () => void;
}) => {
  const subpath = () => relativeNotePath(props.note.path, props.basePath);
  const title = () => props.note.title || "Untitled";

  return (
    <li
      class={rowClass}
      data-active={props.active ? "" : undefined}
      data-note-id={props.note.id}
      onMouseMove={() => {
        if (!props.active) props.onHover();
      }}
    >
      <div class={css({ gridArea: "main", minW: "0" })}>
        <A href={`/docs/${props.note.id}`} class={titleLinkClass}>
          {props.query ? renderHighlighted(title(), props.query) : title()}
        </A>
        <p class={snippetClass}>
          <Suspense fallback={" "}>
            {props.preview() || " "}
          </Suspense>
        </p>
      </div>
      <Show when={props.showSubpath && subpath()} fallback={<span class={css({ gridArea: "sub" })} />}>
        <A
          href={pathToRoute(props.note.path || "")}
          class={subpathClass}
          title={`Open ${props.note.path}`}
        >
          {props.query ? renderHighlighted(subpath(), props.query) : subpath()}
        </A>
      </Show>
      <span class={timeClass} title={`Updated ${formatAbsoluteTime(props.note.updatedAt)}`}>
        {formatRelativeTime(props.note.updatedAt)}
      </span>
    </li>
  );
};
