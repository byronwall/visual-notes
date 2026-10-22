import { For, Show, createSignal, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";

const SCOPE_LABELS: Record<string, string> = {
  "notes:read": "Search and read all of your notes",
  "notes:write":
    "Create notes, and edit only the notes it created (previous versions are kept)",
};

type Props = {
  clientName: string | null;
  redirectHost: string;
  redirectIsLocal: boolean;
  scopes: string[];
  onDecide: (approve: boolean) => Promise<void>;
};

export const OAuthConsentCard: VoidComponent<Props> = (props) => {
  const [pending, setPending] = createSignal<"approve" | "deny" | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const decide = async (approve: boolean) => {
    setPending(approve ? "approve" : "deny");
    setError(null);
    try {
      await props.onDecide(approve);
    } catch (err) {
      setError((err as Error)?.message || "Something went wrong");
      setPending(null);
    }
  };

  return (
    <Stack
      gap="4"
      bg="bg.default"
      borderWidth="1px"
      borderColor="border"
      borderRadius="l3"
      boxShadow="sm"
      p="5"
    >
      <Stack gap="1">
        <Heading as="h1" fontSize="md" m="0">
          Connect {props.clientName || "an app"} to Visual Notes?
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          After you approve, you will return to{" "}
          <Box as="span" fontFamily="mono" color="fg.default">
            {props.redirectHost}
          </Box>
          {props.redirectIsLocal
            ? ", a program running on this computer. Approve only if you just started this sign-in."
            : "."}
        </Text>
      </Stack>
      <Stack as="ul" gap="2" m="0" p="0" listStyle="none">
        <For each={props.scopes}>
          {(scope) => (
            <Box
              as="li"
              fontSize="sm"
              bg="bg.subtle"
              borderRadius="l2"
              px="3"
              py="2"
            >
              {SCOPE_LABELS[scope] ?? scope}
            </Box>
          )}
        </For>
      </Stack>
      <Show when={error()}>
        {(message) => (
          <Text fontSize="sm" color="fg.error">
            {message()}
          </Text>
        )}
      </Show>
      <HStack gap="2" justifyContent="flex-end">
        <Button
          variant="outline"
          disabled={pending() !== null}
          loading={pending() === "deny"}
          onClick={() => void decide(false)}
        >
          Deny
        </Button>
        <Button
          disabled={pending() !== null}
          loading={pending() === "approve"}
          loadingText="Connecting…"
          onClick={() => void decide(true)}
        >
          Approve
        </Button>
      </HStack>
    </Stack>
  );
};
