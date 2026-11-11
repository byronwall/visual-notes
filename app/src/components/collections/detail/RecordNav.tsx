import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "lucide-solid";
import { type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Tooltip } from "~/components/ui/tooltip";

type NavProps = {
  /** "3 of 42" */
  label: string;
  onPrev?: () => void;
  onNext?: () => void;
};

const label = css({
  fontSize: "xs",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

const iconProps = {
  size: "xs",
  variant: "plain",
  colorPalette: "gray",
  minW: "7",
  w: "7",
  h: "7",
  color: "fg.muted",
} as const;

/** Previous/Next beside the panel's header actions, for wide screens. */
export const RecordNavInline: VoidComponent<NavProps> = (props) => (
  <div
    class={css({
      display: { base: "none", sm: "flex" },
      alignItems: "center",
      gap: "0.5",
    })}
    data-record-nav="inline"
  >
    <Tooltip
      content="Previous record (K)"
      showArrow
      portalled={false}
      contentProps={{ zIndex: "tooltip" }}
    >
      <IconButton
        {...iconProps}
        aria-label="Previous record"
        disabled={!props.onPrev}
        onClick={() => props.onPrev?.()}
      >
        <ChevronUpIcon size={16} />
      </IconButton>
    </Tooltip>
    <Tooltip
      content="Next record (J)"
      showArrow
      portalled={false}
      contentProps={{ zIndex: "tooltip" }}
    >
      <IconButton
        {...iconProps}
        aria-label="Next record"
        disabled={!props.onNext}
        onClick={() => props.onNext?.()}
      >
        <ChevronDownIcon size={16} />
      </IconButton>
    </Tooltip>
    <span class={label} data-record-position aria-live="polite">
      {props.label}
    </span>
  </div>
);

const bar = css({
  display: { base: "grid", sm: "none" },
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: "2",
  position: "sticky",
  bottom: "0",
  mt: "auto",
  px: "2",
  pt: "1.5",
  borderTopWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
  zIndex: "docked",
  "& > :last-child": { justifySelf: "end" },
});

/** Previous/Next in reach of the thumb, pinned to the bottom of a phone panel. */
export const RecordNavBar: VoidComponent<NavProps> = (props) => (
  <nav
    class={bar}
    aria-label="Records"
    data-record-nav="bar"
    style={{ "padding-bottom": "max(6px, env(safe-area-inset-bottom))" }}
  >
    <Button
      size="lg"
      variant="plain"
      colorPalette="gray"
      px="3"
      justifySelf="start"
      aria-label="Previous record"
      disabled={!props.onPrev}
      onClick={() => props.onPrev?.()}
    >
      <ChevronLeftIcon />
      Previous
    </Button>
    <span class={label} data-record-position>
      {props.label}
    </span>
    <Button
      size="lg"
      variant="plain"
      colorPalette="gray"
      px="3"
      aria-label="Next record"
      disabled={!props.onNext}
      onClick={() => props.onNext?.()}
    >
      Next
      <ChevronRightIcon />
    </Button>
  </nav>
);
