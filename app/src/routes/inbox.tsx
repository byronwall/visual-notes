import { Title } from "@solidjs/meta";
import { ErrorBoundary, Show, Suspense } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { InboxView } from "~/components/inbox/InboxView";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { fetchUserInbox } from "~/services/annotations/annotations.queries";
import { createKeptAsync } from "~/utils/kept-async";

/** The agent inbox: what agents did that needs you, and what they are on. */
const InboxRoute = () => {
  const inbox = createKeptAsync(() => fetchUserInbox());

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>Inbox • Visual Notes</Title>
      <Stack gap="5" maxW="760px" mx="auto" px={{ base: "3", md: "6" }} pt="5" pb="24">
        <Heading as="h1" fontSize="2xl" px="1">
          Inbox
        </Heading>
        <ErrorBoundary
          fallback={(error) => (
            <Text color="red.11" fontSize="sm" px="1">
              Couldn’t load the inbox: {String(error?.message ?? error)}
            </Text>
          )}
        >
          <Suspense
            fallback={
              <Text px="1" fontSize="sm" color="fg.muted">
                Loading inbox…
              </Text>
            }
          >
            <Show
              when={inbox.latest}
              fallback={
                <Text px="1" fontSize="sm" color="fg.muted">
                  The agent inbox is turned off on this server (AGENT_INBOX=false).
                </Text>
              }
            >
              {(data) => <InboxView inbox={data()} />}
            </Show>
          </Suspense>
        </ErrorBoundary>
      </Stack>
    </Box>
  );
};

export default InboxRoute;
