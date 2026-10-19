import { type JSX, Show } from "solid-js";
import { Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";

type EmptyStateProps = {
  title: string;
  children?: JSX.Element;
  action?: JSX.Element;
  tone?: "default" | "danger";
};

/** Quiet, left-aligned empty/error state used inside secondary page sections. */
export const EmptyState = (props: EmptyStateProps) => (
  <Stack gap="1.5" alignItems="flex-start" px="3" py="6">
    <Text fontSize="sm" fontWeight="medium" color={props.tone === "danger" ? "red.11" : "fg.default"}>
      {props.title}
    </Text>
    <Show when={props.children}>
      {(body) => (
        <Text fontSize="sm" color="fg.muted" maxW="60ch">
          {body()}
        </Text>
      )}
    </Show>
    <Show when={props.action}>{(action) => action()}</Show>
  </Stack>
);
