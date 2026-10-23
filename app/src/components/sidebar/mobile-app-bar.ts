import { createContext, useContext, type Accessor } from "solid-js";
import { css } from "styled-system/css";

/** Height of the fixed phone app bar; content scrolls underneath it. */
export const MOBILE_APP_BAR_PX = 48;

export type MobileAppBarApi = {
  /** Replace the section name in the phone app bar; undefined restores it. */
  setTitle: (title: string | undefined) => void;
  /** Slot in the phone app bar where a page can portal its own actions. */
  actionsSlot: Accessor<HTMLElement | undefined>;
};

const detached: MobileAppBarApi = {
  setTitle: () => {},
  actionsSlot: () => undefined,
};

export const MobileAppBarContext = createContext<MobileAppBarApi>(detached);

export const useMobileAppBar = () => useContext(MobileAppBarContext);

export const mobileBarButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "10",
  flexShrink: "0",
  borderRadius: "l2",
  color: "fg.muted",
  bg: "transparent",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  _active: { bg: "bg.active" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "border.focus",
    outlineOffset: "-2px",
  },
  _motionReduce: { transition: "none" },
});
