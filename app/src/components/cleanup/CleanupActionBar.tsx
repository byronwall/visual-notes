import { Show, createContext, useContext, type VoidComponent } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Kbd } from "~/components/ui/kbd";
import { Text } from "~/components/ui/text";

/** Set by the daily stack: adds "Snooze 30 days" to every action bar. */
export const CleanupSnoozeContext = createContext<(() => void) | null>(null);

/**
 * Approve / Keep as is / Skip for the selected note. Keyboard shortcuts click
 * these buttons by their data attributes (see useCleanupKeys).
 */
export const CleanupActionBar: VoidComponent<{
  primaryLabel: string;
  onPrimary: () => void;
  busy?: boolean;
  disabled?: boolean;
  onKeep: () => void;
  onSkip: () => void;
}> = (props) => {
  const snooze = useContext(CleanupSnoozeContext);
  return (
    <HStack
      gap="2"
      pt="3"
      mt="auto"
      borderTopWidth="1px"
      borderColor="border"
      flexWrap="wrap"
    >
      <Button
        size="sm"
        variant="solid"
        data-cleanup-action="primary"
        loading={props.busy}
        disabled={props.disabled}
        onClick={props.onPrimary}
      >
        {props.primaryLabel}
      </Button>
      <Button
        size="sm"
        variant="outline"
        data-cleanup-action="keep"
        onClick={props.onKeep}
      >
        Keep as is
      </Button>
      <Show when={snooze}>
        {(onSnooze) => (
          <Button
            size="sm"
            variant="outline"
            data-cleanup-action="snooze"
            onClick={() => onSnooze()()}
          >
            Snooze 30 days
          </Button>
        )}
      </Show>
      <Button
        size="sm"
        variant="plain"
        data-cleanup-action="skip"
        onClick={props.onSkip}
      >
        Skip
      </Button>
      <Box flex="1" />
      <HStack gap="1.5" display={{ base: "none", md: "flex" }} color="fg.muted">
        <Kbd size="sm">Enter</Kbd>
        <Kbd size="sm">E</Kbd>
        <Show when={snooze}>
          <Kbd size="sm">Z</Kbd>
        </Show>
        <Kbd size="sm">S</Kbd>
        <Text fontSize="xs">{snooze ? "→ next" : "J/K to move"}</Text>
      </HStack>
    </HStack>
  );
};
