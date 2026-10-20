import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { Suspense } from "solid-js";
import { Box, Container, Stack } from "styled-system/jsx";
import { OAuthConnectionsList } from "~/components/oauth/OAuthConnectionsList";
import { Text } from "~/components/ui/text";
import { fetchOAuthConnections } from "~/services/oauth/oauth-connections";

export default function AdminConnectionsRoute() {
  const connections = createAsync(() => fetchOAuthConnections());

  return (
    <Box as="main" minH="100vh" bg="bg.default">
      <Title>Connected apps • Visual Notes</Title>
      <Container py="4" px="4" maxW="960px">
        <Stack gap="4">
          <Stack gap="1">
            <Text fontSize="2xl" fontWeight="semibold">
              Connected apps
            </Text>
            <Text color="fg.muted" fontSize="sm">
              Apps that can read your notes and save new ones through the MCP
              connector.
            </Text>
          </Stack>
          <Suspense fallback={<Box minH="24" aria-busy="true" />}>
            <OAuthConnectionsList connections={connections() ?? []} />
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
}
