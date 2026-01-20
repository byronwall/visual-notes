import type { Accessor } from "solid-js";
import { Show } from "solid-js";
import { LogInIcon, LogOutIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Link } from "~/components/ui/link";
import { Box, VisuallyHidden } from "styled-system/jsx";

type AppSidebarFooterProps = {
  expanded: boolean;
  authed: Accessor<boolean>;
  onLogout: () => void;
};

export const AppSidebarFooter = (props: AppSidebarFooterProps) => {
  return (
    <Show
      when={props.authed()}
      fallback={
        <Link
          href="/login"
          variant="plain"
          w="full"
          display="flex"
          alignItems="center"
          justifyContent={props.expanded ? "flex-start" : "center"}
          px={props.expanded ? "3" : "2"}
          py="2"
        >
          <LogInIcon size={18} strokeWidth={1.8} aria-hidden="true" />
          <Show when={props.expanded}>
            <Box as="span">Sign in</Box>
          </Show>
          <Show when={!props.expanded}>
            <VisuallyHidden>Sign in</VisuallyHidden>
          </Show>
        </Link>
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
