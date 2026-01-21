import type { Accessor } from "solid-js";
import { Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { LogInIcon, LogOutIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Box, VisuallyHidden } from "styled-system/jsx";

type AppSidebarFooterProps = {
  expanded: boolean;
  authed: Accessor<boolean>;
  onLogout: () => void;
};

export const AppSidebarFooter = (props: AppSidebarFooterProps) => {
  const navigate = useNavigate();
  return (
    <Show
      when={props.authed()}
      fallback={
        <Button
          variant="plain"
          size="sm"
          onClick={() => navigate("/login")}
          w="full"
          display="flex"
          alignItems="center"
          justifyContent={props.expanded ? "flex-start" : "center"}
          px={props.expanded ? "3" : "2"}
          py="2"
          color="fg.muted"
          _hover={{ bg: "bg.muted", color: "fg.default" }}
        >
          <LogInIcon size={18} strokeWidth={1.8} aria-hidden="true" />
          <Show when={props.expanded}>
            <Box as="span">Sign in</Box>
          </Show>
          <Show when={!props.expanded}>
            <VisuallyHidden>Sign in</VisuallyHidden>
          </Show>
        </Button>
      }
    >
      <Button
        variant="outline"
        size="sm"
        colorPalette="red"
        w="full"
        justifyContent={props.expanded ? "flex-start" : "center"}
        onClick={props.onLogout}
        title="Sign out"
      >
        <LogOutIcon size={18} strokeWidth={1.8} aria-hidden="true" />
        <Show when={props.expanded}>
          <Box as="span">Sign out</Box>
        </Show>
        <Show when={!props.expanded}>
          <VisuallyHidden>Sign out</VisuallyHidden>
        </Show>
      </Button>
    </Show>
  );
};
