import type { JSX } from "solid-js";
import { Box } from "styled-system/jsx";
import { AppSidebarContent, type AppSidebarContentProps } from "./AppSidebarContent";

export const SIDEBAR_EXPANDED_WIDTH = "240px";
export const SIDEBAR_COLLAPSED_WIDTH = "56px";

type AppSidebarDesktopProps = Omit<AppSidebarContentProps, "mode"> & {
  children: JSX.Element;
};

export const AppSidebarDesktop = (props: AppSidebarDesktopProps) => {
  const sidebarWidth = () =>
    props.expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <Box display="flex" minH="100dvh" w="full" alignItems="stretch">
      <Box
        display={{ base: "none", md: "block" }}
        flexShrink="0"
        position="sticky"
        top="0"
        alignSelf="flex-start"
        h="100dvh"
        bg="gray.2"
        borderRightWidth="1px"
        borderColor="border"
        data-sidebar-collapsed={props.expanded ? undefined : ""}
        style={{ width: sidebarWidth() }}
      >
        <AppSidebarContent {...props} mode="desktop" />
      </Box>
      <Box
        id="main-content"
        tabIndex={-1}
        minW="0"
        minH={{ base: "auto", md: "100dvh" }}
        pt={{ base: "12", md: "0" }}
        bg="bg.default"
        flex="1"
        outline="none"
      >
        {props.children}
      </Box>
    </Box>
  );
};
