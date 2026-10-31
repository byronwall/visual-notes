import type { JSX } from "solid-js";
import { css } from "styled-system/css";
import { AppSidebarClient } from "./AppSidebarClient";

type AppSidebarLayoutProps = {
  children: JSX.Element;
};

const skipLinkClass = css({
  position: "fixed",
  top: "2",
  left: "2",
  zIndex: "tooltip",
  px: "3",
  py: "1.5",
  borderRadius: "l2",
  bg: "bg.default",
  color: "fg.default",
  fontSize: "sm",
  boxShadow: "md",
  transform: "translateY(-200%)",
  _focus: { transform: "none" },
});

/** Moves focus to the page, past the sidebar. `main` is set by each route. */
const skipToContent = (event: MouseEvent) => {
  event.preventDefault();
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;
  main.tabIndex = -1;
  main.style.outline = "none";
  main.focus();
};

export const AppSidebarLayout = (props: AppSidebarLayoutProps) => {
  return (
    <>
      <a href="#main" class={skipLinkClass} onClick={skipToContent}>
        Skip to content
      </a>
      <AppSidebarClient>{props.children}</AppSidebarClient>
    </>
  );
};
