import { Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { HStack } from "styled-system/jsx";

export const ListEmptyState = (props: {
  message: string;
  tone?: "error";
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <HStack
    role={props.tone === "error" ? "alert" : "status"}
    gap="3"
    px="2"
    py="6"
    fontSize="sm"
    color={props.tone === "error" ? "red.11" : "fg.muted"}
  >
    <span>{props.message}</span>
    <Show when={props.actionLabel}>
      {(label) => (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={props.onAction}
        >
          {label()}
        </Button>
      )}
    </Show>
  </HStack>
);
