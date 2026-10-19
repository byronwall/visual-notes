import { useAction } from "@solidjs/router";
import { BotIcon } from "lucide-solid";
import { For, Show, createSignal, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { formatRelativeShort } from "~/components/doc-header/relative-time";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Text } from "~/components/ui/text";
import {
  revokeOAuthConnection,
  type OAuthConnection,
} from "~/services/oauth/oauth-connections";

type Props = { connections: OAuthConnection[] };

export const OAuthConnectionsList: VoidComponent<Props> = (props) => {
  const revoke = useAction(revokeOAuthConnection);
  const [pending, setPending] = createSignal<OAuthConnection | null>(null);
  const now = Date.now();

  const confirmRevoke = async () => {
    const target = pending();
    setPending(null);
    if (target) await revoke(target.id);
  };

  return (
    <>
      <Show
        when={props.connections.length}
        fallback={
          <Box bg="bg.subtle" borderRadius="l3" p="6" textAlign="center">
            <Text color="fg.muted" fontSize="sm">
              No apps are connected. Add Visual Notes as a connector in ChatGPT
              to see it here.
            </Text>
          </Box>
        }
      >
        <Stack as="ul" gap="1" m="0" p="0" listStyle="none">
          <For each={props.connections}>
            {(connection) => (
              <HStack
                as="li"
                gap="4"
                px="3"
                py="2.5"
                borderRadius="l2"
                bg="bg.subtle"
                opacity={connection.revokedAt ? 0.6 : 1}
                justifyContent="space-between"
                flexWrap="wrap"
              >
                <HStack gap="3" minW="0">
                  <BotIcon size={18} />
                  <Stack gap="0" minW="0">
                    <HStack gap="2">
                      <Text fontSize="sm" fontWeight="medium" truncate>
                        {connection.clientName ?? "Unnamed app"}
                      </Text>
                      <Show when={connection.revokedAt}>
                        <Badge size="sm" variant="outline">
                          Revoked
                        </Badge>
                      </Show>
                    </HStack>
                    <Text
                      fontSize="xs"
                      color="fg.muted"
                      fontFamily="mono"
                      truncate
                    >
                      {connection.clientId}
                    </Text>
                  </Stack>
                </HStack>
                <HStack
                  gap="4"
                  rowGap="1"
                  flexWrap="wrap"
                  whiteSpace="nowrap"
                  ml={{ base: "8", md: "0" }}
                >
                  <Text fontSize="xs" color="fg.muted">
                    Connected {formatRelativeShort(now, connection.createdAt)}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    Last used{" "}
                    {connection.lastUsedAt
                      ? formatRelativeShort(now, connection.lastUsedAt)
                      : "never"}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {connection.notesCreated}{" "}
                    {connection.notesCreated === 1 ? "note" : "notes"} created
                  </Text>
                  <Show when={!connection.revokedAt}>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setPending(connection)}
                    >
                      Revoke
                    </Button>
                  </Show>
                </HStack>
              </HStack>
            )}
          </For>
        </Stack>
      </Show>
      <ConfirmDialog
        open={pending() !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Revoke this connection?"
        description="The app loses access immediately. Notes it saved stay in Visual Notes."
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        onConfirm={() => void confirmRevoke()}
      />
    </>
  );
};
