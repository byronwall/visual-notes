import type { Accessor } from "solid-js";
import { Show } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import {
  ActivityIcon,
  LogInIcon,
  LogOutIcon,
  ShieldIcon,
  SparklesIcon,
} from "lucide-solid";
import { HStack } from "styled-system/jsx";
import { SidebarFooterIconLink } from "./SidebarFooterIconLink";

type AppSidebarFooterProps = {
  expanded: boolean;
  authed: Accessor<boolean>;
  onLogout: () => void;
};

export const AppSidebarFooter = (props: AppSidebarFooterProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = () => location.pathname;
  const isAdminActive = () =>
    pathname() === "/admin/archive" || pathname().startsWith("/admin/");
  const isAiActive = () => pathname() === "/ai" || pathname().startsWith("/ai/");
  const isActivityActive = () =>
    pathname() === "/activity" || pathname().startsWith("/activity/");

  return (
    <HStack gap="1" justifyContent="center">
      <SidebarFooterIconLink
        label="AI Dashboard"
        onClick={() => navigate("/ai")}
        active={isAiActive()}
        icon={<SparklesIcon size={18} strokeWidth={1.8} aria-hidden="true" />}
      />
      <SidebarFooterIconLink
        label="Activity"
        onClick={() => navigate("/activity")}
        active={isActivityActive()}
        icon={<ActivityIcon size={18} strokeWidth={1.8} aria-hidden="true" />}
      />
      <Show
        when={props.authed()}
        fallback={
          <SidebarFooterIconLink
            label="Sign in"
            onClick={() => navigate("/login")}
            icon={<LogInIcon size={18} strokeWidth={1.8} aria-hidden="true" />}
          />
        }
      >
        <SidebarFooterIconLink
          label="Admin"
          onClick={() => navigate("/admin")}
          active={isAdminActive()}
          icon={<ShieldIcon size={18} strokeWidth={1.8} aria-hidden="true" />}
        />
        <SidebarFooterIconLink
          label="Sign out"
          onClick={props.onLogout}
          variant="outline"
          colorPalette="red"
          icon={<LogOutIcon size={18} strokeWidth={1.8} aria-hidden="true" />}
        />
      </Show>
    </HStack>
  );
};
