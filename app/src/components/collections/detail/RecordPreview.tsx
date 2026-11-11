import { FilterXIcon } from "lucide-solid";
import { type JSX, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";

const title = css({
  fontSize: "3xl",
  lineHeight: "1.15",
  fontWeight: "bold",
  mb: "4",
  overflowWrap: "anywhere",
});

/**
 * The record's name and properties from the collection, shown while its note
 * loads. The store already holds them, so moving between records shows them
 * at once.
 */
export const RecordPreview = (props: {
  name: string;
  children: JSX.Element;
}) => (
  <div data-part="preview">
    <div class={title}>{props.name}</div>
    {props.children}
  </div>
);

const notice = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  mb: "2",
  px: "2",
  py: "1",
  borderRadius: "l2",
  bg: "bg.muted",
  color: "fg.muted",
  fontSize: "xs",
  w: "fit-content",
});

/** Says the open record left the view's results after an edit. */
export const OutOfViewNotice: VoidComponent = () => (
  <div class={notice} role="status" data-record-out-of-view>
    <FilterXIcon size={12} />
    No longer matches this view's filters
  </div>
);
