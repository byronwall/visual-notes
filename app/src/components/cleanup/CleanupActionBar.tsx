import { Show, createContext, useContext, type VoidComponent } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";

/** Marks a button that spends money, so the label says so before the click. */
export const paidLabel = (label: string) => `${label} · paid`;

/** Set by the daily stack: adds "Snooze 30 days" to every action bar. */
export const CleanupSnoozeContext = createContext<(() => void) | null>(null);

/** The key for a button, on the button. Phones have no keys to show. */
const KeyHint: VoidComponent<{ label: string }> = (props) => (
  <Box
    as="kbd"
    aria-hidden="true"
    display={{ base: "none", md: "inline" }}
    fontFamily="inherit"
    fontSize="xs"
    fontWeight="normal"
    opacity="0.7"
  >
    {props.label}
  </Box>
);

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
      py="3"
      mt="auto"
      borderTopWidth="1px"
      borderColor="border"
      flexWrap="wrap"
      bg="bg.default"
      position={{ base: "sticky", lg: "static" }}
      bottom="0"
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
        <KeyHint label="Enter" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        data-cleanup-action="keep"
        onClick={props.onKeep}
      >
        Keep as is
        <KeyHint label="E" />
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
            <KeyHint label="Z" />
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
        <KeyHint label="S" />
      </Button>
      <Show when={!snooze}>
        <Box
          display={{ base: "none", lg: "block" }}
          ml="auto"
          fontSize="xs"
          color="fg.muted"
        >
          J/K to move
        </Box>
      </Show>
    </HStack>
  );
};
