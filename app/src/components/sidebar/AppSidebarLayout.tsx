import type { JSX } from "solid-js";
import { AppSidebarClient } from "./AppSidebarClient";

type AppSidebarLayoutProps = {
  children: JSX.Element;
};

export const AppSidebarLayout = (props: AppSidebarLayoutProps) => {
  return <AppSidebarClient>{props.children}</AppSidebarClient>;
};
