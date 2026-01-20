import type { JSX } from "solid-js";
import { Show, createSignal, onMount } from "solid-js";
import { AppSidebarClient } from "./AppSidebarClient";

type AppSidebarLayoutProps = {
  children: JSX.Element;
};

export const AppSidebarLayout = (props: AppSidebarLayoutProps) => {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);
  });

  return (
    <Show when={mounted()} fallback={props.children}>
      <AppSidebarClient>{props.children}</AppSidebarClient>
    </Show>
  );
};
